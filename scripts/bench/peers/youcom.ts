// You.com adapter: Web Search API, POST https://ydc-index.io/v1/search with
// X-API-Key. Docs: https://you.com/docs/api-reference/search/v1-search (API
// `v1`, read 2026-10-21). Price: $5 / 1,000 calls, $100 free credits with no
// card, self-serve default 10 requests per second
// (https://you.com/resources/you-com-web-search-api).
import { Effect, Schema } from 'effect'
import type { HttpClient } from 'effect/http'
import type { Provider } from './model.ts'
import type { Post } from './peers.ts'

const SEARCH_USD = 0.005

const Hit = Schema.Struct({
  url: Schema.String,
  title: Schema.optionalKey(Schema.String),
  snippets: Schema.optionalKey(Schema.Array(Schema.String)),
})
const SearchOut = Schema.Struct({
  results: Schema.Struct({ web: Schema.optionalKey(Schema.Array(Hit)) }),
})

export const youcom = (
  post: Post,
  key: string,
  _client: HttpClient.HttpClient,
): Provider['jobs'] => ({
  search: ({ query = '' }) =>
    post(
      'https://ydc-index.io/v1/search',
      { 'x-api-key': key },
      { query, count: 5 },
      SearchOut,
    ).pipe(
      Effect.map(({ r, sentBytes }) => {
        const hits = r.results.web ?? []
        const text = hits.map((h) => `${h.title ?? ''}\n${h.url}\n${(h.snippets ?? []).join('\n')}`)
        const urls = hits.map((h) => h.url)
        return { text: text.join('\n\n'), urls, citations: [], costUsd: SEARCH_USD, sentBytes }
      }),
    ),
})
