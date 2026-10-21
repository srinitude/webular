// Browserbase adapter: Search (POST `/v1/search`) and Fetch (POST `/v1/fetch`,
// markdown) as the scrape job, both with the x-bb-api-key header.
// Docs: https://docs.browserbase.com/platform/search/overview and
// https://docs.browserbase.com/reference/api/fetch-a-page (API as served on 2026-10-21).
// Pricing: https://www.browserbase.com/pricing (Developer: search $1 / 1k for
// Parallel Fast, fetch $1 / 1k calls; the Free plan includes 1,000 of each).
// Cold runs: Fetch documents no cache option, so none is set.
import { Effect, Schema } from 'effect'
import type { HttpClient } from 'effect/http'
import type { Provider } from './model.ts'
import type { Post } from './peers.ts'

const API = 'https://api.browserbase.com/v1'
const SEARCH_USD = 0.001
const FETCH_USD = 0.001

const SearchOut = Schema.Struct({
  results: Schema.Array(
    Schema.Struct({ url: Schema.String, title: Schema.optionalKey(Schema.NullOr(Schema.String)) }),
  ),
})
const FetchOut = Schema.Struct({ statusCode: Schema.Number, content: Schema.String })

const output = (text: string, urls: string[], costUsd: number, sentBytes: number) => ({
  text,
  urls,
  citations: [],
  costUsd,
  sentBytes,
})

export const browserbase = (
  post: Post,
  key: string,
  _client: HttpClient.HttpClient,
): Provider['jobs'] => {
  const auth = { 'x-bb-api-key': key }
  return {
    search: ({ query = '' }) =>
      post(`${API}/search`, auth, { query, numResults: 5 }, SearchOut).pipe(
        Effect.map(({ r, sentBytes }) => {
          const text = r.results.map((h) => `${h.title ?? ''}\n${h.url}`).join('\n\n')
          const urls = r.results.map((h) => h.url)
          return output(text, urls, SEARCH_USD, sentBytes)
        }),
      ),
    scrape: ({ url = '' }) =>
      post(`${API}/fetch`, auth, { url, format: 'markdown' }, FetchOut).pipe(
        Effect.map(({ r, sentBytes }) => output(r.content, [url], FETCH_USD, sentBytes)),
      ),
  }
}
