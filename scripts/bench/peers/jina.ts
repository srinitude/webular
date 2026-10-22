// Jina adapter: Reader (r.jina.ai) for scrape and Search (s.jina.ai) for
// search, both POST with `Accept: application/json`.
// Docs: https://jina.ai/reader/ and https://github.com/jina-ai/reader (API as
// served on 2026-10-21; no version header). Pricing: https://jina.ai/reader/#pricing
// bills tokens; s.jina.ai costs a fixed 10,000 tokens per call.
// Cold runs: `X-No-Cache: true` is sent on every call.
// Keyless: Reader works with no key at 20 RPM, so an empty key sends no
// Authorization header; costUsd still reports the paid list price.
// Search needs a key (keyless is blocked).
import { Effect, Schema } from 'effect'
import type { HttpClient } from 'effect/http'
import type { Provider } from './model.ts'
import type { Post } from './peers.ts'

// ponytail: one flat token rate; switch to the billed rate once the pricing
// page's per-token figure is pinned for the plan the bench runs on.
const USD_PER_TOKEN = 0.05 / 1_000_000
const SEARCH_TOKENS = 10_000

const Page = Schema.Struct({
  url: Schema.String,
  title: Schema.optionalKey(Schema.String),
  description: Schema.optionalKey(Schema.String),
  content: Schema.optionalKey(Schema.String),
  usage: Schema.optionalKey(Schema.Struct({ tokens: Schema.Number })),
})
const ReadOut = Schema.Struct({ data: Page })
const SearchOut = Schema.Struct({ data: Schema.Array(Page) })

const headers = (key: string): Record<string, string> => ({
  accept: 'application/json',
  'x-no-cache': 'true',
  ...(key ? { authorization: `Bearer ${key}` } : {}),
})

const output = (text: string, urls: string[], tokens: number, sentBytes: number) => ({
  text,
  urls,
  citations: [],
  costUsd: tokens * USD_PER_TOKEN,
  sentBytes,
})

export const jina = (
  post: Post,
  key: string,
  _client: HttpClient.HttpClient,
): Provider['jobs'] => ({
  scrape: ({ url = '' }) =>
    post('https://r.jina.ai/', headers(key), { url }, ReadOut).pipe(
      Effect.map(({ r, sentBytes }) =>
        output(r.data.content ?? '', [url], r.data.usage?.tokens ?? 0, sentBytes),
      ),
    ),
  search: ({ query = '' }) =>
    post('https://s.jina.ai/', headers(key), { q: query, num: 5 }, SearchOut).pipe(
      Effect.map(({ r, sentBytes }) => {
        const text = r.data.map((h) => `${h.title ?? ''}\n${h.url}\n${h.description ?? ''}`)
        const urls = r.data.map((h) => h.url)
        return output(text.join('\n\n'), urls, SEARCH_TOKENS, sentBytes)
      }),
    ),
})
