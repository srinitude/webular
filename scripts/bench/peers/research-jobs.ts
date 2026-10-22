// Research job adapters. Perplexity Agent API (POST /v1/agent, preset `high`,
// the documented replacement for sonar-deep-research, whose chat endpoint is
// retired) and Exa Agent (POST /agent/runs, then GET /agent/runs/{id} until a
// terminal status). Both ask at effort `high`, so the arms match.
import { Effect, Schema } from 'effect'
import { type HttpClient, HttpClientRequest, HttpClientResponse } from 'effect/http'
import type { BenchError, Provider } from './model.ts'
import { fail, out, type Post } from './peers.ts'
import { CALL_TIMEOUT_MS } from './timeout.ts'

type Jobs = Provider['jobs']
export type Get = <A>(
  url: string,
  headers: Record<string, string>,
  schema: Schema.Codec<A>,
) => Effect.Effect<A, BenchError>

export const getter =
  (client: HttpClient.HttpClient): Get =>
  (url, headers, schema) =>
    HttpClientRequest.get(url).pipe(
      HttpClientRequest.setHeaders(headers),
      (req) => client.execute(req),
      Effect.flatMap(HttpClientResponse.filterStatusOk),
      Effect.flatMap((res) => res.json),
      Effect.flatMap(Schema.decodeUnknownEffect(schema)),
      Effect.mapError(fail),
    )

export const POLL_MS = 2_000
// ponytail: the docs list no Perplexity per-request rate; flat estimate until a live run reports usage.
const PPLX_RESEARCH_USD = 0.05

const Part = Schema.Struct({ type: Schema.String, text: Schema.optionalKey(Schema.String) })
const PplxAgent = Schema.Struct({
  output: Schema.Array(
    Schema.Struct({ type: Schema.String, content: Schema.optionalKey(Schema.Array(Part)) }),
  ),
})

export const perplexityResearch = (post: Post, key: string): Jobs => ({
  research: ({ query = '' }) =>
    post(
      'https://api.perplexity.ai/v1/agent',
      { authorization: `Bearer ${key}` },
      { input: query, preset: 'high' },
      PplxAgent,
    ).pipe(
      Effect.map(({ r, sentBytes }) => {
        const text = r.output
          .filter((o) => o.type === 'message')
          .flatMap((o) => o.content ?? [])
          .filter((p) => p.type === 'output_text')
          .map((p) => p.text ?? '')
          .join('\n')
        return out(text, [], PPLX_RESEARCH_USD, sentBytes)
      }),
    ),
})

const ExaRun = Schema.Struct({
  id: Schema.String,
  status: Schema.String,
  output: Schema.optionalKey(Schema.Struct({ text: Schema.optionalKey(Schema.String) })),
  costDollars: Schema.optionalKey(Schema.Struct({ total: Schema.optionalKey(Schema.Number) })),
  error: Schema.optionalKey(Schema.Struct({ message: Schema.optionalKey(Schema.String) })),
})
const RUNS = 'https://api.exa.ai/agent/runs'
const finished = (status: string) => ['completed', 'failed', 'cancelled'].includes(status)

export const exaResearch = (post: Post, get: Get, key: string): Jobs => ({
  research: ({ query = '' }) => {
    const auth = { authorization: `Bearer ${key}` }
    const poll = (id: string): Effect.Effect<typeof ExaRun.Type, BenchError> =>
      get(`${RUNS}/${id}`, auth, ExaRun).pipe(
        Effect.flatMap((r) =>
          finished(r.status) ? Effect.succeed(r) : Effect.delay(poll(id), POLL_MS),
        ),
        Effect.timeout(CALL_TIMEOUT_MS),
        Effect.mapError(fail),
      )
    return post(RUNS, auth, { query, effort: 'high' }, ExaRun).pipe(
      Effect.flatMap(({ r, sentBytes }) =>
        (finished(r.status) ? Effect.succeed(r) : poll(r.id)).pipe(
          Effect.flatMap((run) =>
            run.status === 'completed'
              ? Effect.succeed(
                  out(run.output?.text ?? '', [], run.costDollars?.total ?? 0, sentBytes),
                )
              : Effect.fail(fail(run.error?.message ?? run.status)),
          ),
        ),
      ),
    )
  },
})
