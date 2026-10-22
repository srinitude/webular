// The provider set: webular in-process through its real Mastra workflows, and
// each peer behind one Layer that owns its HTTP client and key. A peer with
// no key is built with `skip` set, so the report says so instead of faking it.
import { Context, Effect, Layer, Schema } from 'effect'
import { HttpClient } from 'effect/http'
import { answerWorkflow } from '../../../src/workflows/answer.ts'
import { extractWorkflow } from '../../../src/workflows/extract.ts'
import { mapWorkflow } from '../../../src/workflows/map.ts'
import { scrapeWorkflow } from '../../../src/workflows/scrape.ts'
import { searchWorkflow } from '../../../src/workflows/search.ts'
import { apify } from './apify.ts'
import { awaitingApproval } from './awaiting-approval.ts'
import { baselines } from './baselines.ts'
import { brightdata } from './brightdata.ts'
import { browserbase } from './browserbase.ts'
import { contextdev } from './contextdev.ts'
import { extracted, firecrawlExtract } from './extract-jobs.ts'
import { extractSpecs } from './extract-tasks.ts'
import { gemini } from './gemini.ts'
import { jina } from './jina.ts'
import { readKey } from './keys.ts'
import { linkup } from './linkup.ts'
import { firecrawlMap, listed, MAP_LIMIT, tavilyMap } from './map-jobs.ts'
import type { Provider } from './model.ts'
import { nimble } from './nimble.ts'
import { parallel } from './parallel.ts'
import { bytes, exa, fail, firecrawl, type Post, perplexity, poster, tavily } from './peers.ts'
import { scrapegraph } from './scrapegraph.ts'
import { serpapi } from './serpapi.ts'
import { serper } from './serper.ts'
import { tinyfish } from './tinyfish.ts'
import { valyu } from './valyu.ts'
import { youcom } from './youcom.ts'

interface Flow {
  createRun(): Promise<{
    start(a: { inputData: unknown }): Promise<{ status: string; result?: unknown; error?: Error }>
  }>
}

const runFlow = <A>(flow: unknown, schema: Schema.Codec<A>, inputData: unknown) =>
  Effect.tryPromise({ try: () => (flow as Flow).createRun(), catch: fail }).pipe(
    Effect.flatMap((run) =>
      Effect.tryPromise({ try: () => run.start({ inputData }), catch: fail }),
    ),
    Effect.filterOrFail(
      (o) => o.status === 'success',
      (o) => fail(o.error?.message ?? o.status),
    ),
    Effect.flatMap((o) => Schema.decodeUnknownEffect(schema)(o.result).pipe(Effect.mapError(fail))),
  )

const Ref = Schema.Struct({ title: Schema.String, url: Schema.String })
const SearchOut = Schema.Struct({
  results: Schema.Array(Schema.Struct({ ...Ref.fields, description: Schema.String })),
})
const ScrapeOut = Schema.Struct({ markdown: Schema.String })
const MapOut = Schema.Struct({ links: Schema.Array(Schema.String) })
const ExtractOut = Schema.Struct({ data: Schema.Record(Schema.String, Schema.String) })
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
    map: ({ url = '' }) =>
      runFlow(mapWorkflow, MapOut, { url, limit: MAP_LIMIT }).pipe(
        Effect.map((r) => listed(r.links, 0, 0)),
      ),
    extract: ({ url = '' }) =>
      runFlow(extractWorkflow, ExtractOut, { url, fields: extractSpecs[url]?.fields }).pipe(
        Effect.map((r) => extracted(r.data, url, 0, 0)),
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

type Make = (post: Post, key: string, client: HttpClient.HttpClient) => Provider['jobs']

// `keyless` peers (Jina Reader) still run with no key, on their free limits.
const peer = (id: string, env: string, item: string, make: Make, keyless = false) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient
    const key = yield* readKey(env, item)
    const base = { id, local: false, keyNames: [item] }
    if (!key && !keyless)
      return { ...base, jobs: {}, skip: `no key (env ${env} or Keychain ${item})` }
    return { ...base, jobs: make(poster(client), key ?? '', client) }
  })

export class Peers extends Context.Service<Peers, readonly Provider[]>()('bench/Peers') {}

export const PeersLive = Layer.effect(
  Peers,
  Effect.all([
    Effect.succeed(webular),
    peer('firecrawl', 'FIRECRAWL_API_KEY', 'firecrawl', (p, k) => ({
      ...firecrawl(p, k),
      ...firecrawlMap(p, k),
      ...firecrawlExtract(p, k),
    })),
    peer('exa', 'EXA_API_KEY', 'exa-api-key', exa),
    peer('tavily', 'TAVILY_API_KEY', 'tavily-api-key', (p, k) => ({
      ...tavily(p, k),
      ...tavilyMap(p, k),
    })),
    peer('perplexity', 'PERPLEXITY_API_KEY', 'perplexity-api-key', perplexity),
    peer('parallel', 'PARALLEL_API_KEY', 'parallel-api-key', parallel),
    peer('youcom', 'YOUCOM_API_KEY', 'youcom-api-key', youcom),
    peer('linkup', 'LINKUP_API_KEY', 'linkup-api-key', linkup),
    peer('valyu', 'VALYU_API_KEY', 'valyu-api-key', valyu),
    peer('jina', 'JINA_API_KEY', 'jina-api-key', jina, true),
    peer('tinyfish', 'TINYFISH_API_KEY', 'tinyfish-api-key', tinyfish),
    peer('browserbase', 'BROWSERBASE_API_KEY', 'browserbase-api-key', browserbase),
    peer('gemini', 'GEMINI_API_KEY', 'gemini-api-key', gemini),
    peer('serpapi', 'SERPAPI_API_KEY', 'serpapi-api-key', serpapi),
    peer('serper', 'SERPER_API_KEY', 'serper-api-key', serper),
    peer('brightdata', 'BRIGHTDATA_API_KEY', 'brightdata-api-key', brightdata),
    peer('scrapegraph', 'SCRAPEGRAPH_API_KEY', 'scrapegraph-api-key', scrapegraph),
    peer('apify', 'APIFY_TOKEN', 'apify-api-key', apify),
    peer('nimble', 'NIMBLE_API_KEY', 'nimble-api-key', nimble),
    peer('contextdev', 'CONTEXTDEV_API_KEY', 'contextdev-api-key', contextdev),
  ]).pipe(Effect.zipWith(baselines, (peers, local) => [...peers, ...local, ...awaitingApproval])),
)
