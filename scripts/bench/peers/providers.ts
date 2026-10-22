// The provider set: webular in-process (webular.ts), and each peer behind one
// Layer that owns its HTTP client and key. A peer with no key is built with
// `skip` set, so the report says so instead of faking it.
import { Context, Effect, Layer } from 'effect'
import { HttpClient } from 'effect/http'
import { firecrawlAct } from './act-jobs.ts'
import { apify } from './apify.ts'
import { awaitingApproval } from './awaiting-approval.ts'
import { baselines } from './baselines.ts'
import { exaBatch, firecrawlBatch, tavilyBatch } from './batch-jobs.ts'
import { brightdata } from './brightdata.ts'
import { browserbase } from './browserbase.ts'
import { contextdev } from './contextdev.ts'
import { firecrawlCrawl, tavilyCrawl } from './crawl-jobs.ts'
import { firecrawlExtract } from './extract-jobs.ts'
import { gemini } from './gemini.ts'
import { jina } from './jina.ts'
import { readKey } from './keys.ts'
import { linkup } from './linkup.ts'
import { firecrawlMap, tavilyMap } from './map-jobs.ts'
import { firecrawlMedia } from './media-jobs.ts'
import type { Provider } from './model.ts'
import { firecrawlMonitor } from './monitor-jobs.ts'
import { nimble } from './nimble.ts'
import { parallel } from './parallel.ts'
import { firecrawlParse } from './parse-jobs.ts'
import { exa, firecrawl, type Post, perplexity, poster, tavily } from './peers.ts'
import { exaResearch, getter, perplexityResearch } from './research-jobs.ts'
import { scrapegraph } from './scrapegraph.ts'
import { serpapi } from './serpapi.ts'
import { serper } from './serper.ts'
import { exaSummarize } from './summarize-jobs.ts'
import { tinyfish } from './tinyfish.ts'
import { valyu } from './valyu.ts'
import { webular } from './webular.ts'
import { youcom } from './youcom.ts'

export { webular }

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
