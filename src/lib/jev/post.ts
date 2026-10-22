// One Jev HTTP call: docs guard, POST, reply decode, one jittered retry, and the
// same-model retry. client.ts owns the endpoint and wires this in.
import { Clock, Effect, identity, Option, Random, Redacted, Schema } from 'effect'
import type * as HttpClient from 'effect/http/HttpClient'
import * as HttpClientRequest from 'effect/http/HttpClientRequest'
import { logErr } from '../../core/output.ts'
import type { DocsState } from './docs-cache.ts'
import { committedSnapshot, guarded, httpFetcher } from './docs-guard.ts'
import { errorKind, JevError, nextAction, retryAfterMs, retryable } from './errors.ts'

const TIMEOUT_MS = 3_000 // Jev's slow tail is about 2 s
const RETRY_BASE_MS = 200 // full jitter: one retry after a random 0 to 200 ms
const MAX_RETRY_AFTER_MS = 5_000 // a longer server wait falls back instead of stalling the step
const NO_KEY = 'no TypeSafe API key'
const IMAGES_HEADER = 'TypeSafe-Danger-Zone-Images'
const ASSETS_KEY = ',"assets":{' // only requestBytes writes this; quotes inside strings are escaped

const Answer = Schema.Struct({
  type: Schema.String,
  noul: Schema.optional(Schema.Number),
  choice: Schema.optional(Schema.String),
  score: Schema.optional(Schema.Number),
  box: Schema.optional(
    Schema.Struct({
      top: Schema.Number,
      bottom: Schema.Number,
      left: Schema.Number,
      right: Schema.Number,
    }),
  ),
  confidence: Schema.optional(Schema.NullOr(Schema.Number)),
  probabilities: Schema.optional(Schema.Record(Schema.String, Schema.Number)),
})
const Reply = Schema.Struct({
  model: Schema.String,
  answers: Schema.Record(Schema.String, Answer),
  usage: Schema.optional(Schema.Struct({ input_tokens: Schema.Number })),
})
const decodeReply = Schema.decodeUnknownEffect(Reply)
export const Result = Schema.Struct({
  answers: Schema.Record(Schema.String, Answer),
  inputTokens: Schema.Number,
  model: Schema.optional(Schema.String), // the versioned id that answered
  source: Schema.optional(Schema.Literals(['jev', 'cache', 'replay'])), // where it came from
})
type Post = (body: string) => Effect.Effect<typeof Result.Type, JevError>

// Docs guard: current TypeSafe docs (one conditional GET), then their limits, before the call.
const guardDocs = (http: HttpClient.HttpClient, body: string, docs: DocsState) =>
  guarded(
    body,
    docs,
    httpFetcher(http),
    (l) =>
      l.event === 'unchanged' ? Effect.void : logErr(`jev docs ${l.event} ${l.reason ?? ''}`),
    Effect.void,
  ).pipe(
    Effect.mapError(
      (e) => new JevError({ reason: `docs guard: ${e.reason}`, kind: 'bad_request' }),
    ),
  )

const httpError = (res: {
  status: number
  headers: Readonly<Record<string, string | undefined>>
}) =>
  Effect.gen(function* () {
    const kind = errorKind(res.status)
    const reason = `HTTP ${res.status}: ${nextAction(kind)}`
    return yield* new JevError({
      reason,
      kind,
      retryAfterMs: retryAfterMs(res.headers, yield* Clock.currentTimeMillis),
    })
  })

const jevRequest = (endpoint: string, key: Redacted.Redacted<string>, body: string) =>
  HttpClientRequest.post(endpoint).pipe(
    HttpClientRequest.bearerToken(Redacted.value(key)),
    HttpClientRequest.bodyText(body, 'application/json'),
    // Images are gated: the header is required on every request that carries one.
    body.includes(ASSETS_KEY) ? HttpClientRequest.setHeader(IMAGES_HEADER, 'true') : identity,
  )

export const postOnce =
  (
    endpoint: string,
    http: HttpClient.HttpClient,
    key: Option.Option<Redacted.Redacted<string>>,
    docs: DocsState = { snapshot: committedSnapshot },
  ): Post =>
  (body) =>
    Effect.gen(function* () {
      if (Option.isNone(key)) return yield* new JevError({ reason: NO_KEY, kind: 'no_key' })
      yield* guardDocs(http, body, docs)
      const req = jevRequest(endpoint, key.value, body)
      const res = yield* http.execute(req)
      if (res.status >= 400) return yield* httpError(res)
      const reply = yield* decodeReply(yield* res.json)
      const { answers, model } = reply
      const inputTokens = reply.usage?.input_tokens ?? 0
      return { answers, inputTokens, model, source: 'jev' } satisfies typeof Result.Type
    }).pipe(
      Effect.timeoutOrElse({
        duration: TIMEOUT_MS,
        orElse: () => Effect.fail(new JevError({ reason: 'timeout', kind: 'timeout' })),
      }),
      Effect.mapError((e) =>
        e instanceof JevError ? e : new JevError({ reason: String(e), kind: 'network' }),
      ),
    )

// One retry, only for a kind that can pass on retry. A 429 waits the server's
// retryAfterMs (up to MAX_RETRY_AFTER_MS; longer falls back at once); the rest
// wait a full-jitter 0 to RETRY_BASE_MS, so callers that fail together do not
// retry together.
const retryJitter = <A>(eff: Effect.Effect<A, JevError>) =>
  eff.pipe(
    Effect.catchTag('JevError', (e) => {
      const kind = e.kind ?? 'network'
      if (!retryable(kind)) return Effect.fail(e)
      if (kind === 'rate_limited' && e.retryAfterMs !== undefined)
        return e.retryAfterMs > MAX_RETRY_AFTER_MS
          ? Effect.fail(e)
          : Effect.sleep(e.retryAfterMs).pipe(Effect.andThen(eff))
      return Random.nextIntBetween(0, RETRY_BASE_MS).pipe(
        Effect.flatMap((ms) => Effect.sleep(ms)),
        Effect.andThen(eff),
      )
    }),
  )

// The retry stays on the same model: a failed call never moves to an older
// release. When the retry fails too, the caller's rule-based fallback answers.
export const withRetry = (post: Post) => (body: string) => retryJitter(post(body))
