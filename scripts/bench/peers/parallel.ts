// Parallel adapter: Search (/v1/search, x-api-key) and the OpenAI-compatible
// Responses API (/v1/responses, Bearer) for answers. Search runs in `fast`
// mode and answers at `low` effort, the cheapest tiers and the closest match
// to the other peers' default calls. List prices: PRICING_SOURCES.parallel.
import { Effect, Schema } from 'effect'
import type { Provider } from './model.ts'
import { out, type Post } from './peers.ts'

const API = 'https://api.parallel.ai/v1'
const SEARCH_USD = 0.001
const ANSWER_USD = 0.01

const SearchOut = Schema.Struct({
  results: Schema.Array(
    Schema.Struct({
      url: Schema.String,
      title: Schema.optionalKey(Schema.NullOr(Schema.String)),
      excerpts: Schema.optionalKey(Schema.Array(Schema.String)),
    }),
  ),
})
const Part = Schema.Struct({
  type: Schema.String,
  text: Schema.optionalKey(Schema.String),
  annotations: Schema.optionalKey(Schema.Array(Schema.Struct({ url: Schema.String }))),
})
const ResponseOut = Schema.Struct({
  output: Schema.Array(
    Schema.Struct({ type: Schema.String, content: Schema.optionalKey(Schema.Array(Part)) }),
  ),
})

// The answer is the output_text parts of message items; their url_citation
// annotations are the cited sources, deduped in order.
const answerParts = (r: typeof ResponseOut.Type) =>
  r.output
    .filter((o) => o.type === 'message')
    .flatMap((o) => o.content ?? [])
    .filter((p) => p.type === 'output_text')

const search = (post: Post, key: string, query: string) =>
  post(
    `${API}/search`,
    { 'x-api-key': key },
    {
      objective: query,
      search_queries: [query],
      mode: 'fast',
      advanced_settings: { max_results: 5 },
    },
    SearchOut,
  ).pipe(
    Effect.map(({ r, sentBytes }) => {
      const text = r.results.map(
        (h) => `${h.title ?? ''}\n${h.url}\n${(h.excerpts ?? []).join('\n')}`,
      )
      return out(
        text.join('\n\n'),
        r.results.map((h) => h.url),
        SEARCH_USD,
        sentBytes,
      )
    }),
  )

const answer = (post: Post, key: string, query: string) =>
  post(
    `${API}/responses`,
    { authorization: `Bearer ${key}` },
    { model: 'parallel', input: query, reasoning: { effort: 'low' } },
    ResponseOut,
  ).pipe(
    Effect.map(({ r, sentBytes }) => {
      const parts = answerParts(r)
      const urls = [...new Set(parts.flatMap((p) => (p.annotations ?? []).map((a) => a.url)))]
      const text = parts.map((p) => p.text ?? '').join('\n')
      const citations = urls.map((url) => ({ url, text: '' }))
      return { ...out(text, urls, ANSWER_USD, sentBytes), citations }
    }),
  )

export const parallel = (post: Post, key: string): Provider['jobs'] => ({
  search: ({ query = '' }) => search(post, key, query),
  answer: ({ query = '' }) => answer(post, key, query),
})
