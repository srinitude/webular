// Linkup adapter: POST https://api.linkup.so/v1/search with Bearer auth.
// outputType `searchResults` serves search and `sourcedAnswer` serves answer;
// both run at `fast` depth, the docs' recommended default. Docs:
// https://docs.linkup.so/pages/documentation/endpoints/search/reference (API
// `v1`, read 2026-10-21). Price: $0.005 to $0.006 per call, free queries with
// no card (https://www.linkup.so/pricing).
import { Effect, Schema } from 'effect'
import type { HttpClient } from 'effect/http'
import type { Provider } from './model.ts'
import type { Post } from './peers.ts'

const API = 'https://api.linkup.so/v1/search'
const CALL_USD = 0.005

const SearchOut = Schema.Struct({
  results: Schema.Array(
    Schema.Struct({
      url: Schema.String,
      name: Schema.optionalKey(Schema.String),
      content: Schema.optionalKey(Schema.String),
    }),
  ),
})
const AnswerOut = Schema.Struct({
  answer: Schema.String,
  sources: Schema.Array(
    Schema.Struct({ url: Schema.String, snippet: Schema.optionalKey(Schema.String) }),
  ),
})

const body = (q: string, outputType: string) => ({ q, depth: 'fast', outputType, maxResults: 5 })

export const linkup = (
  post: Post,
  key: string,
  _client: HttpClient.HttpClient,
): Provider['jobs'] => {
  const auth = { authorization: `Bearer ${key}` }
  return {
    search: ({ query = '' }) =>
      post(API, auth, body(query, 'searchResults'), SearchOut).pipe(
        Effect.map(({ r, sentBytes }) => {
          const text = r.results.map((h) => `${h.name ?? ''}\n${h.url}\n${h.content ?? ''}`)
          const urls = r.results.map((h) => h.url)
          return { text: text.join('\n\n'), urls, citations: [], costUsd: CALL_USD, sentBytes }
        }),
      ),
    answer: ({ query = '' }) =>
      post(API, auth, body(query, 'sourcedAnswer'), AnswerOut).pipe(
        Effect.map(({ r, sentBytes }) => {
          const citations = r.sources.map((s) => ({ url: s.url, text: s.snippet ?? '' }))
          const urls = citations.map((c) => c.url)
          return { text: r.answer, urls, citations, costUsd: CALL_USD, sentBytes }
        }),
      ),
  }
}
