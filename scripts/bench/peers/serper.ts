// Serper adapter: Google results as JSON from POST /search (X-API-KEY header).
// Docs: https://serper.dev/playground (API at google.serper.dev, read 2026-10-21).
// Free terms: 2,500 queries on sign-up, no card. Pricing: https://serper.dev/
// (smallest pack $50 / 50,000 queries, so list price $0.001 per search).
import { Effect, Schema } from 'effect'
import type { HttpClient } from 'effect/http'
import type { Provider } from './model.ts'
import type { Post } from './peers.ts'

const SEARCH_USD = 0.001

const Reply = Schema.Struct({
  organic: Schema.Array(
    Schema.Struct({
      link: Schema.String,
      title: Schema.optionalKey(Schema.String),
      snippet: Schema.optionalKey(Schema.String),
    }),
  ),
})

export const serper = (
  post: Post,
  key: string,
  _client: HttpClient.HttpClient,
): Provider['jobs'] => ({
  search: ({ query = '' }) =>
    post(
      'https://google.serper.dev/search',
      { 'x-api-key': key },
      { q: query, num: 5 },
      Reply,
    ).pipe(
      Effect.map(({ r, sentBytes }) => ({
        text: r.organic.map((h) => `${h.title ?? ''}\n${h.link}\n${h.snippet ?? ''}`).join('\n\n'),
        urls: r.organic.map((h) => h.link),
        citations: [],
        costUsd: SEARCH_USD,
        sentBytes,
      })),
    ),
})
