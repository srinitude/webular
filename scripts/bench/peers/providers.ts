// The provider set: webular in-process through its real Mastra workflows, and
// each peer behind one Layer that owns its HTTP client and key. A peer with
// no key is built with `skip` set, so the report says so instead of faking it.
import { Context, Effect, Layer, Schema } from 'effect'
import { HttpClient } from 'effect/http'
import { answerWorkflow } from '../../../src/workflows/answer.ts'
import { scrapeWorkflow } from '../../../src/workflows/scrape.ts'
import { searchWorkflow } from '../../../src/workflows/search.ts'
import { readKey } from './keys.ts'
import type { Provider } from './model.ts'
import { bytes, exa, fail, firecrawl, perplexity, poster, tavily } from './peers.ts'

interface Flow {
  createRun(): Promise<{
    start(a: { inputData: unknown }): Promise<{ status: string; result?: unknown; error?: Error }>
  }>
}

const runFlow = <A>(flow: unknown, schema: Schema.Codec<A>, inputData: unknown) =>
  Effect.tryPromise({
    try: async () => {
      const run = await (flow as Flow).createRun()
      const o = await run.start({ inputData })
      if (o.status !== 'success') throw new Error(o.error?.message ?? o.status)
      return o.result
    },
    catch: fail,
  }).pipe(Effect.flatMap((r) => Schema.decodeUnknownEffect(schema)(r).pipe(Effect.mapError(fail))))

const Ref = Schema.Struct({ title: Schema.String, url: Schema.String })
const SearchOut = Schema.Struct({
  results: Schema.Array(Schema.Struct({ ...Ref.fields, description: Schema.String })),
})
const ScrapeOut = Schema.Struct({ markdown: Schema.String })
const AnswerOut = Schema.Struct({ answer: Schema.String, sources: Schema.Array(Ref) })

export const webular: Provider = {
  id: 'webular',
  local: true,
  keyNames: [],
  jobs: {
    search: ({ query = '' }) =>
      runFlow(searchWorkflow, SearchOut, { query, limit: 5 }).pipe(
        Effect.map((r) => ({
          text: r.results.map((h) => `${h.title}\n${h.url}\n${h.description}`).join('\n\n'),
          urls: r.results.map((h) => h.url),
          citations: [],
          costUsd: 0,
          sentBytes: bytes(query),
        })),
      ),
    scrape: ({ url = '' }) =>
      runFlow(scrapeWorkflow, ScrapeOut, { url }).pipe(
        Effect.map((r) => ({
          text: r.markdown,
          urls: [url],
          citations: [],
          costUsd: 0,
          sentBytes: 0,
        })),
      ),
    // Citations carry no text: the answer workflow returns only title and url.
    answer: ({ query = '' }) =>
      runFlow(answerWorkflow, AnswerOut, { query, sources: 3, sentences: 3 }).pipe(
        Effect.map((r) => ({
          text: r.answer,
          urls: r.sources.map((s) => s.url),
          citations: r.sources.map((s) => ({ url: s.url, text: '' })),
          costUsd: 0,
          sentBytes: bytes(query),
        })),
      ),
  },
}

type Make = (post: ReturnType<typeof poster>, key: string) => Provider['jobs']

const peer = (id: string, env: string, item: string, make: Make) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient
    const key = yield* readKey(env, item)
    const base = { id, local: false, keyNames: [item] }
    if (!key) return { ...base, jobs: {}, skip: `no key (env ${env} or Keychain ${item})` }
    return { ...base, jobs: make(poster(client), key) }
  })

export class Peers extends Context.Service<Peers, readonly Provider[]>()('bench/Peers') {}

export const PeersLive = Layer.effect(
  Peers,
  Effect.all([
    Effect.succeed(webular),
    peer('firecrawl', 'FIRECRAWL_API_KEY', 'firecrawl', firecrawl),
    peer('exa', 'EXA_API_KEY', 'exa-api-key', exa),
    peer('tavily', 'TAVILY_API_KEY', 'tavily-api-key', tavily),
    peer('perplexity', 'PERPLEXITY_API_KEY', 'perplexity-api-key', perplexity),
    peer('parallel', 'PARALLEL_API_KEY', 'parallel-api-key', () => ({})),
  ]),
)
