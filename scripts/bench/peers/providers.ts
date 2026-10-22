// The provider set: webular in-process through its real Mastra workflows, and
// each peer behind one Layer that owns its HTTP client and key. A peer with
// no key is built with `skip` set, so the report says so instead of faking it.
import { Context, Effect, Layer, Schema } from 'effect'
import { HttpClient } from 'effect/http'
import { actWorkflow } from '../../../src/workflows/act.ts'
import { answerWorkflow } from '../../../src/workflows/answer.ts'
import { batchWorkflow } from '../../../src/workflows/batch.ts'
import { crawlWorkflow } from '../../../src/workflows/crawl.ts'
import { extractWorkflow } from '../../../src/workflows/extract.ts'
import { mapWorkflow } from '../../../src/workflows/map.ts'
import { mediaWorkflow } from '../../../src/workflows/media.ts'
import { monitorWorkflow } from '../../../src/workflows/monitor.ts'
import { parseWorkflow } from '../../../src/workflows/parse.ts'
import { researchWorkflow } from '../../../src/workflows/research.ts'
import { scrapeWorkflow } from '../../../src/workflows/scrape.ts'
import { searchWorkflow } from '../../../src/workflows/search.ts'
import { summarizeWorkflow } from '../../../src/workflows/summarize.ts'
import { firecrawlAct } from './act-jobs.ts'
import { actGoal } from './act-tasks.ts'
import { apify } from './apify.ts'
import { awaitingApproval } from './awaiting-approval.ts'
import { baselines } from './baselines.ts'
import { batchTargets, exaBatch, firecrawlBatch, pagesOut, tavilyBatch } from './batch-jobs.ts'
import { brightdata } from './brightdata.ts'
import { browserbase } from './browserbase.ts'
import { contextdev } from './contextdev.ts'
import { firecrawlCrawl, tavilyCrawl, webularCrawl } from './crawl-jobs.ts'
import { extracted, firecrawlExtract } from './extract-jobs.ts'
import { extractSpecs } from './extract-tasks.ts'
import { gemini } from './gemini.ts'
import { jina } from './jina.ts'
import { readKey } from './keys.ts'
import { linkup } from './linkup.ts'
import { firecrawlMap, listed, MAP_LIMIT, tavilyMap } from './map-jobs.ts'
import { firecrawlMedia, MediaOut, mediaInput, savedImage } from './media-jobs.ts'
import type { Provider } from './model.ts'
import { firecrawlMonitor, MonitorOut, webularMonitor } from './monitor-jobs.ts'
import { nimble } from './nimble.ts'
import { parallel } from './parallel.ts'
import { firecrawlParse, ParseOut, webularParse } from './parse-jobs.ts'
import { bytes, exa, fail, firecrawl, out, type Post, perplexity, poster, tavily } from './peers.ts'
import { exaResearch, getter, perplexityResearch } from './research-jobs.ts'
import { scrapegraph } from './scrapegraph.ts'
import { serpapi } from './serpapi.ts'
import { serper } from './serper.ts'
import { exaSummarize, SUMMARY_SENTENCES, SummarizeOut, summarized } from './summarize-jobs.ts'
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
const ResearchOut = Schema.Struct({ report: Schema.String, sources: Schema.Array(Ref) })

const BatchOut = Schema.Struct({
  results: Schema.Array(
    Schema.Struct({ url: Schema.String, title: Schema.optionalKey(Schema.String) }),
  ),
})

const searchJobs: Provider['jobs'] = {
  ...webularMonitor((i) => runFlow(monitorWorkflow, MonitorOut, i)),
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
}

const pageJobs: Provider['jobs'] = {
  map: ({ url = '' }) =>
    runFlow(mapWorkflow, MapOut, { url, limit: MAP_LIMIT }).pipe(
      Effect.map((r) => listed(r.links, 0, 0)),
    ),
  extract: ({ url = '' }) =>
    runFlow(extractWorkflow, ExtractOut, { url, fields: extractSpecs[url]?.fields }).pipe(
      Effect.map((r) => extracted(r.data, url, 0, 0)),
    ),
  crawl: ({ url = '' }) => webularCrawl(runFlow, crawlWorkflow, scrapeWorkflow, url),
  // The batch workflow reports each page's title, and no title for a failed page.
  batch: ({ url = '' }) =>
    runFlow(batchWorkflow, BatchOut, { urls: batchTargets(url) }).pipe(
      Effect.map((r) =>
        pagesOut(
          r.results.map((h) => ({ url: h.url, text: h.title ?? '' })),
          0,
          0,
        ),
      ),
    ),
  media: ({ url = '' }) =>
    mediaInput(url).pipe(
      Effect.flatMap((input) => runFlow(mediaWorkflow, MediaOut, input)),
      Effect.flatMap((r) => savedImage(r, url)),
    ),
  ...webularParse((file) => runFlow(parseWorkflow, ParseOut, { file })),
  summarize: ({ url = '' }) =>
    runFlow(summarizeWorkflow, SummarizeOut, { url, sentences: SUMMARY_SENTENCES }).pipe(
      Effect.map((r) => summarized(r.summary, url, 0, 0)),
    ),
}

const ActOut = Schema.Struct({
  url: Schema.String,
  snapshot: Schema.String,
  next: Schema.optionalKey(Schema.String),
})

const answerJobs: Provider['jobs'] = {
  // The act workflow opens, snapshots, and closes; it clicks nothing itself.
  act: ({ url = '' }) =>
    runFlow(actWorkflow, ActOut, { url, goal: actGoal }).pipe(
      Effect.map((r) => out(`${r.snapshot}\n${r.next ?? ''}`, [url], 0, 0)),
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
  research: ({ query = '' }) =>
    runFlow(researchWorkflow, ResearchOut, { topic: query, depth: 3, sentences: 2 }).pipe(
      Effect.map((r) => ({
        text: r.report,
        urls: r.sources.map((s) => s.url),
        citations: [],
        costUsd: 0,
        sentBytes: bytes(query),
      })),
    ),
}

export const webular: Provider = {
  id: 'webular',
  local: true,
  keyNames: [],
  jobs: { ...searchJobs, ...pageJobs, ...answerJobs },
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
    peer('firecrawl', 'FIRECRAWL_API_KEY', 'firecrawl', (p, k, c) => ({
      ...firecrawl(p, k),
      ...firecrawlCrawl(p, getter(c), k),
      ...firecrawlBatch(p, k, c),
      ...firecrawlMap(p, k),
      ...firecrawlExtract(p, k),
      ...firecrawlMedia(p, k),
      ...firecrawlParse(p, k),
      ...firecrawlAct(p, k),
      ...firecrawlMonitor(p, k),
    })),
    peer('exa', 'EXA_API_KEY', 'exa-api-key', (p, k, c) => ({
      ...exa(p, k),
      ...exaResearch(p, getter(c), k),
      ...exaSummarize(p, k),
      ...exaBatch(p, k),
    })),
    peer('tavily', 'TAVILY_API_KEY', 'tavily-api-key', (p, k) => ({
      ...tavily(p, k),
      ...tavilyMap(p, k),
      ...tavilyCrawl(p, k),
      ...tavilyBatch(p, k),
    })),
    peer('perplexity', 'PERPLEXITY_API_KEY', 'perplexity-api-key', (p, k) => ({
      ...perplexity(p, k),
      ...perplexityResearch(p, k),
    })),
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
