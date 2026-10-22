// Map job adapters: list a site's URLs. Firecrawl POST /v2/map and Tavily
// POST /map are the rival endpoints; every arm asks for the same page limit.
import { Effect, Schema } from 'effect'
import type { Output, Provider } from './model.ts'
import { out, type Post } from './peers.ts'

export const MAP_LIMIT = 100
// Firecrawl map: 1 credit at $83 / 100,000. Tavily map: 1 credit ($0.008) per 10 pages.
const FIRECRAWL_MAP_USD = 83 / 100_000
const TAVILY_CREDIT_USD = 0.008

type Jobs = Provider['jobs']
const FcMap = Schema.Struct({ links: Schema.Array(Schema.Struct({ url: Schema.String })) })
const TvMap = Schema.Struct({ results: Schema.Array(Schema.String) })

export const listed = (urls: readonly string[], costUsd: number, sentBytes: number): Output =>
  out(urls.join('\n'), [...urls], costUsd, sentBytes)

export const firecrawlMap = (post: Post, key: string): Jobs => ({
  map: ({ url = '' }) =>
    post(
      'https://api.firecrawl.dev/v2/map',
      { authorization: `Bearer ${key}` },
      { url, limit: MAP_LIMIT },
      FcMap,
    ).pipe(
      Effect.map(({ r, sentBytes }) =>
        listed(
          r.links.map((l) => l.url),
          FIRECRAWL_MAP_USD,
          sentBytes,
        ),
      ),
    ),
})

export const tavilyMap = (post: Post, key: string): Jobs => ({
  map: ({ url = '' }) =>
    post(
      'https://api.tavily.com/map',
      { authorization: `Bearer ${key}` },
      { url, limit: MAP_LIMIT },
      TvMap,
    ).pipe(
      Effect.map(({ r, sentBytes }) =>
        listed(r.results, Math.ceil(r.results.length / 10) * TAVILY_CREDIT_USD, sentBytes),
      ),
    ),
})
