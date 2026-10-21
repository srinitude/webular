// Nimble adapter: Search (`POST /v2/search`) and Extract (`POST /v2/extract`),
// both Bearer-authenticated JSON. Docs: https://docs.nimbleway.com/
// List prices (https://docs.nimbleway.com/nimble-sdk/admin/pricing): standard
// search $5.00 / 1k, extract $1.00 / 1k URLs. Free: 5,000 pages, no card.
import { Effect, Schema } from 'effect'
import type { Output, Provider } from './model.ts'
import type { Post } from './peers.ts'

const API = 'https://sdk.nimbleway.com/v2'
const SEARCH_USD = 0.005
const EXTRACT_USD = 0.001

const SearchOut = Schema.Struct({
  results: Schema.Array(
    Schema.Struct({
      url: Schema.String,
      title: Schema.optionalKey(Schema.NullOr(Schema.String)),
      description: Schema.optionalKey(Schema.NullOr(Schema.String)),
    }),
  ),
})
const ExtractOut = Schema.Struct({ data: Schema.Struct({ markdown: Schema.String }) })

const out = (text: string, urls: string[], costUsd: number, sentBytes: number): Output => ({
  text,
  urls,
  citations: [],
  costUsd,
  sentBytes,
})

export const nimble = (post: Post, key: string): Provider['jobs'] => {
  const auth = { authorization: `Bearer ${key}` }
  return {
    search: ({ query = '' }) =>
      post(
        `${API}/search`,
        auth,
        { query, focus: 'general', max_results: 5, search_depth: 'standard' },
        SearchOut,
      ).pipe(
        Effect.map(({ r, sentBytes }) => {
          const text = r.results.map((h) => `${h.title ?? ''}\n${h.url}\n${h.description ?? ''}`)
          const urls = r.results.map((h) => h.url)
          return out(text.join('\n\n'), urls, SEARCH_USD, sentBytes)
        }),
      ),
    scrape: ({ url = '' }) =>
      post(`${API}/extract`, auth, { url, formats: ['markdown'] }, ExtractOut).pipe(
        Effect.map(({ r, sentBytes }) => out(r.data.markdown, [url], EXTRACT_USD, sentBytes)),
      ),
  }
}
