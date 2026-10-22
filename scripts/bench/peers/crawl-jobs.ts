// Crawl job adapters: walk a site from one URL and return each page's text.
// Firecrawl POST /v2/crawl starts an async crawl that is polled by id; Tavily
// POST /crawl answers in one call. Every arm gets the same page limit and depth.
import { Effect, Schema } from 'effect'
import type { BenchError, Output, Provider } from './model.ts'
import { fail, out, type Post } from './peers.ts'
import type { Get } from './research-jobs.ts'

export const CRAWL_LIMIT = 10
export const CRAWL_DEPTH = 2
const POLL_MS = 2000
// Firecrawl crawl: 1 credit per page at $83 / 100,000. Tavily crawl: 1 credit per
// 10 pages mapped plus 1 per 5 pages extracted (basic), $0.008 a credit.
const FIRECRAWL_PAGE_USD = 83 / 100_000
const TAVILY_CREDIT_USD = 0.008

type Jobs = Provider['jobs']
interface Page {
  url: string
  text: string
}
export type RunFlow = <A>(
  flow: unknown,
  schema: Schema.Codec<A>,
  input: unknown,
) => Effect.Effect<A, BenchError>

// One page per block, headed by its URL, so a gold check reads the page's text.
export const crawled = (pages: readonly Page[], costUsd: number, sentBytes: number): Output =>
  out(
    pages.map((p) => `## ${p.url}\n\n${p.text}`).join('\n\n'),
    pages.map((p) => p.url),
    costUsd,
    sentBytes,
  )

const FcStart = Schema.Struct({ id: Schema.String })
const FcStatus = Schema.Struct({
  status: Schema.String,
  data: Schema.optionalKey(
    Schema.Array(
      Schema.Struct({
        markdown: Schema.optionalKey(Schema.String),
        metadata: Schema.Struct({ sourceURL: Schema.String }),
      }),
    ),
  ),
})
const TvCrawl = Schema.Struct({
  results: Schema.Array(Schema.Struct({ url: Schema.String, raw_content: Schema.String })),
})

const fcOutput = (s: typeof FcStatus.Type, sentBytes: number): Output => {
  const data = s.data ?? []
  return crawled(
    data.map((d) => ({ url: d.metadata.sourceURL, text: d.markdown ?? '' })),
    data.length * FIRECRAWL_PAGE_USD,
    sentBytes,
  )
}

// ponytail: reads the first status page only; Firecrawl pages results past 10 MB
// through `next`, which a 10-page crawl of small pages never reaches.
export const firecrawlCrawl = (post: Post, get: Get, key: string): Jobs => {
  const auth = { authorization: `Bearer ${key}` }
  const api = 'https://api.firecrawl.dev/v2/crawl'
  const poll = (id: string): Effect.Effect<typeof FcStatus.Type, BenchError> =>
    get(`${api}/${id}`, auth, FcStatus).pipe(
      Effect.flatMap((s) =>
        s.status === 'scraping'
          ? Effect.sleep(POLL_MS).pipe(Effect.andThen(poll(id)))
          : Effect.succeed(s),
      ),
    )
  const body = (url: string) => ({
    url,
    limit: CRAWL_LIMIT,
    maxDiscoveryDepth: CRAWL_DEPTH,
    scrapeOptions: { formats: ['markdown'] },
  })
  return {
    crawl: ({ url = '' }) =>
      post(api, auth, body(url), FcStart).pipe(
        Effect.flatMap(({ r, sentBytes }) =>
          poll(r.id).pipe(
            Effect.filterOrFail(
              (s) => s.status === 'completed',
              (s) => fail(`crawl ${s.status}`),
            ),
            Effect.map((s) => fcOutput(s, sentBytes)),
          ),
        ),
      ),
  }
}

export const tavilyCrawl = (post: Post, key: string): Jobs => ({
  crawl: ({ url = '' }) =>
    post(
      'https://api.tavily.com/crawl',
      { authorization: `Bearer ${key}` },
      {
        url,
        limit: CRAWL_LIMIT,
        max_depth: CRAWL_DEPTH,
        extract_depth: 'basic',
        format: 'markdown',
      },
      TvCrawl,
    ).pipe(
      Effect.map(({ r, sentBytes }) =>
        crawled(
          r.results.map((p) => ({ url: p.url, text: p.raw_content })),
          (Math.ceil(r.results.length / 10) + Math.ceil(r.results.length / 5)) * TAVILY_CREDIT_USD,
          sentBytes,
        ),
      ),
    ),
})

const CrawlOut = Schema.Struct({ pages: Schema.Array(Schema.Struct({ url: Schema.String })) })
const ScrapeOut = Schema.Struct({ markdown: Schema.String })

// webular: its crawl workflow lists the pages, its scrape workflow reads each one.
export const webularCrawl = (
  run: RunFlow,
  crawlFlow: unknown,
  scrapeFlow: unknown,
  url: string,
): Effect.Effect<Output, BenchError> =>
  run(crawlFlow, CrawlOut, { url, limit: CRAWL_LIMIT, depth: CRAWL_DEPTH }).pipe(
    Effect.flatMap(({ pages }) =>
      Effect.forEach(
        pages,
        (p) =>
          run(scrapeFlow, ScrapeOut, { url: p.url }).pipe(
            Effect.map((s) => ({ url: p.url, text: s.markdown })),
            Effect.orElseSucceed(() => ({ url: p.url, text: '' })),
          ),
        { concurrency: 4 },
      ),
    ),
    Effect.map((pages) => crawled(pages, 0, 0)),
  )
