// Valyu adapter: POST https://api.valyu.ai/v1/search with x-api-key, web
// sources only so it matches the other peers. The reply's
// total_deduction_dollars is the billed cost, so it is the costUsd.
// Docs: https://docs.valyu.ai/api-reference/endpoint/search (API `v1`, read
// 2026-10-21). Pricing: https://www.valyu.ai/pricing ($10 free credits on
// signup, no card).
import { Effect, Schema } from 'effect'
import type { HttpClient } from 'effect/http'
import type { Provider } from './model.ts'
import type { Post } from './peers.ts'

const SearchOut = Schema.Struct({
  results: Schema.Array(
    Schema.Struct({
      url: Schema.String,
      title: Schema.optionalKey(Schema.String),
      content: Schema.optionalKey(Schema.String),
    }),
  ),
  total_deduction_dollars: Schema.Number,
})

export const valyu = (
  post: Post,
  key: string,
  _client: HttpClient.HttpClient,
): Provider['jobs'] => ({
  search: ({ query = '' }) =>
    post(
      'https://api.valyu.ai/v1/search',
      { 'x-api-key': key },
      { query, search_type: 'web', max_num_results: 5 },
      SearchOut,
    ).pipe(
      Effect.map(({ r, sentBytes }) => {
        const text = r.results.map((h) => `${h.title ?? ''}\n${h.url}\n${h.content ?? ''}`)
        const urls = r.results.map((h) => h.url)
        const costUsd = r.total_deduction_dollars
        return { text: text.join('\n\n'), urls, citations: [], costUsd, sentBytes }
      }),
    ),
})
