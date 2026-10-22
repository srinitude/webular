// Batch job adapters: scrape many URLs in one call. Firecrawl POST /v2/batch/scrape
// (async: start, then poll), Exa POST /contents and Tavily POST /extract (both
// synchronous with many URLs). Every arm gets the same URL list.
import { Effect, Schedule, Schema } from 'effect'
import { type HttpClient, HttpClientRequest, HttpClientResponse } from 'effect/http'
import type { Output, Provider } from './model.ts'
import { fail, type Post } from './peers.ts'
import { CALL_TIMEOUT_MS } from './timeout.ts'

// Firecrawl: 1 credit per URL at $83 / 100,000. Exa contents: $1 / 1k pages.
// Tavily extract: 1 credit ($0.008) per 5 URLs extracted (basic depth).
const FIRECRAWL_PAGE_USD = 83 / 100_000
const EXA_PAGE_USD = 0.001
const TAVILY_CREDIT_USD = 0.008
// One status poll a second for at most the call timeout.
const POLLS = CALL_TIMEOUT_MS / 1000

type Jobs = Provider['jobs']
interface Page {
  url: string
  text: string
}

// The batch task input is one string: comma-joined URLs. A later entry may be a
// path, resolved against the first (the run swaps `{fixture}` in the first only).
export const batchTargets = (spec: string): string[] => {
  const [first = '', ...rest] = spec.split(',')
  return [first, ...rest.map((s) => new URL(s, first).href)]
}

// One block per page: its URL, then its text. A page with no text is a miss.
export const pagesOut = (pages: readonly Page[], costUsd: number, sentBytes: number): Output => ({
  text: pages.map((p) => `${p.url}\n${p.text}`).join('\n\n'),
  urls: pages.filter((p) => p.text.trim() !== '').map((p) => p.url),
  citations: [],
  costUsd,
  sentBytes,
})

const FcStart = Schema.Struct({ id: Schema.String })
const FcStatus = Schema.Struct({
  status: Schema.String,
  data: Schema.optionalKey(
    Schema.Array(
      Schema.Struct({
        markdown: Schema.optionalKey(Schema.NullOr(Schema.String)),
        metadata: Schema.Struct({ sourceURL: Schema.String }),
      }),
    ),
  ),
})
const ExaContents = Schema.Struct({
  results: Schema.Array(
    Schema.Struct({ url: Schema.String, text: Schema.optionalKey(Schema.NullOr(Schema.String)) }),
  ),
  costDollars: Schema.optionalKey(Schema.Struct({ total: Schema.Number })),
})
const TvExtract = Schema.Struct({
  results: Schema.Array(Schema.Struct({ url: Schema.String, raw_content: Schema.String })),
})

const firecrawlStatus = (client: HttpClient.HttpClient, key: string, id: string) =>
  client
    .execute(
      HttpClientRequest.get(`https://api.firecrawl.dev/v2/batch/scrape/${id}`).pipe(
        HttpClientRequest.setHeaders({ authorization: `Bearer ${key}` }),
      ),
    )
    .pipe(
      Effect.flatMap(HttpClientResponse.filterStatusOk),
      Effect.flatMap((res) => res.json),
      Effect.flatMap(Schema.decodeUnknownEffect(FcStatus)),
      Effect.mapError(fail),
    )

// Poll until the batch leaves `scraping`; anything but `completed` is an error.
const firecrawlDone = (client: HttpClient.HttpClient, key: string, id: string) =>
  firecrawlStatus(client, key, id).pipe(
    Effect.repeat({
      schedule: Schedule.spaced('1 second').pipe(Schedule.upTo({ times: POLLS })),
      while: (s) => s.status === 'scraping',
    }),
    Effect.timeout(CALL_TIMEOUT_MS),
    Effect.mapError(fail),
    Effect.filterOrFail(
      (s) => s.status === 'completed',
      (s) => fail(`batch ended ${s.status}`),
    ),
  )

export const firecrawlBatch = (post: Post, key: string, client: HttpClient.HttpClient): Jobs => ({
  batch: ({ url = '' }) => {
    const urls = batchTargets(url)
    const start = post(
      'https://api.firecrawl.dev/v2/batch/scrape',
      { authorization: `Bearer ${key}` },
      { urls, formats: ['markdown'] },
      FcStart,
    )
    return start.pipe(
      Effect.flatMap(({ r, sentBytes }) =>
        firecrawlDone(client, key, r.id).pipe(
          Effect.map((s) => {
            const pages = (s.data ?? []).map((d) => ({
              url: d.metadata.sourceURL,
              text: d.markdown ?? '',
            }))
            return pagesOut(pages, urls.length * FIRECRAWL_PAGE_USD, sentBytes)
          }),
        ),
      ),
    )
  },
})

export const exaBatch = (post: Post, key: string): Jobs => ({
  batch: ({ url = '' }) =>
    post(
      'https://api.exa.ai/contents',
      { 'x-api-key': key },
      { urls: batchTargets(url), text: true },
      ExaContents,
    ).pipe(
      Effect.map(({ r, sentBytes }) =>
        pagesOut(
          r.results.map((h) => ({ url: h.url, text: h.text ?? '' })),
          r.costDollars?.total ?? r.results.length * EXA_PAGE_USD,
          sentBytes,
        ),
      ),
    ),
})

export const tavilyBatch = (post: Post, key: string): Jobs => ({
  batch: ({ url = '' }) =>
    post(
      'https://api.tavily.com/extract',
      { authorization: `Bearer ${key}` },
      { urls: batchTargets(url), format: 'markdown' },
      TvExtract,
    ).pipe(
      Effect.map(({ r, sentBytes }) =>
        pagesOut(
          r.results.map((h) => ({ url: h.url, text: h.raw_content })),
          Math.ceil(r.results.length / 5) * TAVILY_CREDIT_USD,
          sentBytes,
        ),
      ),
    ),
})
