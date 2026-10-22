// Context.dev adapter: Scrape (`POST /v1/web/scrape`, markdown) and Search
// (`POST /v1/web/search`), both Bearer-authenticated JSON.
// Docs: https://docs.context.dev/ Pricing: https://docs.context.dev/account/credits
// (scrape 1 credit, search 1 credit per 10 results) at the lowest paid overage
// rate, $2.20 / 1k credits (https://www.context.dev/pricing). Free: 1,000 credits / month, no card.
import { Effect, Schema } from 'effect'
import type { Output, Provider } from './model.ts'
import type { Post } from './peers.ts'

const API = 'https://api.context.dev/v1'
const CREDIT_USD = 0.0022

const ScrapeOut = Schema.Struct({
  markdown: Schema.Struct({ data: Schema.NullOr(Schema.String) }),
})
const SearchOut = Schema.Struct({
  results: Schema.Array(
    Schema.Struct({
      url: Schema.String,
      title: Schema.optionalKey(Schema.NullOr(Schema.String)),
      description: Schema.optionalKey(Schema.NullOr(Schema.String)),
    }),
  ),
})

const out = (text: string, urls: string[], costUsd: number, sentBytes: number): Output => ({
  text,
  urls,
  citations: [],
  costUsd,
  sentBytes,
})

export const contextdev = (post: Post, key: string): Provider['jobs'] => {
  const auth = { authorization: `Bearer ${key}` }
  return {
    search: ({ query = '' }) =>
      post(`${API}/web/search`, auth, { query, numResults: 5 }, SearchOut).pipe(
        Effect.map(({ r, sentBytes }) => {
          const text = r.results.map((h) => `${h.title ?? ''}\n${h.url}\n${h.description ?? ''}`)
          const urls = r.results.map((h) => h.url)
          return out(text.join('\n\n'), urls, CREDIT_USD, sentBytes)
        }),
      ),
    scrape: ({ url = '' }) =>
      post(`${API}/web/scrape`, auth, { url, formats: { markdown: true } }, ScrapeOut).pipe(
        Effect.map(({ r, sentBytes }) => out(r.markdown.data ?? '', [url], CREDIT_USD, sentBytes)),
      ),
  }
}
