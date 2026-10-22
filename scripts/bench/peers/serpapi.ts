// SerpApi adapter: Google results as JSON from GET /search.json. The API takes
// the key only as the `api_key` URL param, so the key rides in the URL here.
// Docs: https://serpapi.com/search-api (read 2026-10-21).
// Free terms: 250 searches per month, 50 per hour, no card.
// Pricing: https://serpapi.com/pricing (Starter $25 / 1,000 searches, so list
// price $0.025 per search).
import { Effect, Schema } from 'effect'
import { type HttpClient, HttpClientRequest, HttpClientResponse } from 'effect/http'
import type { Provider } from './model.ts'
import { bytes, fail, type Post } from './peers.ts'
import { CALL_TIMEOUT_MS } from './timeout.ts'

const SEARCH_USD = 0.025

const Reply = Schema.Struct({
  organic_results: Schema.Array(
    Schema.Struct({
      link: Schema.String,
      title: Schema.optionalKey(Schema.String),
      snippet: Schema.optionalKey(Schema.String),
    }),
  ),
})

const search = (client: HttpClient.HttpClient, key: string, query: string) => {
  const params = { engine: 'google', q: query, num: '5' }
  const urlParams = { ...params, api_key: key }
  return client
    .execute(HttpClientRequest.get('https://serpapi.com/search.json', { urlParams }))
    .pipe(
      Effect.flatMap(HttpClientResponse.filterStatusOk),
      Effect.flatMap((res) => res.json),
      Effect.flatMap(Schema.decodeUnknownEffect(Reply)),
      Effect.timeout(CALL_TIMEOUT_MS),
      Effect.map((r) => ({
        text: r.organic_results
          .map((h) => `${h.title ?? ''}\n${h.link}\n${h.snippet ?? ''}`)
          .join('\n\n'),
        urls: r.organic_results.map((h) => h.link),
        citations: [],
        costUsd: SEARCH_USD,
        // The key is ours, not task data: count only the query params.
        sentBytes: bytes(new URLSearchParams(params).toString()),
      })),
      Effect.mapError(fail),
    )
}

export const serpapi = (
  _post: Post,
  key: string,
  client: HttpClient.HttpClient,
): Provider['jobs'] => ({
  search: ({ query = '' }) => search(client, key, query),
})
