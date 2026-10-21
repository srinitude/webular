// TinyFish adapter: Search (GET api.search.tinyfish.ai?query=) and Fetch
// (POST api.fetch.tinyfish.ai, markdown), both with the X-API-Key header.
// Docs: https://docs.tinyfish.ai/search-api and https://docs.tinyfish.ai/fetch-api
// (API as served on 2026-10-21; no version header).
// Pricing: https://www.tinyfish.ai/blog/search-and-fetch-are-now-free-for-every-agent-everywhere
// Search and Fetch are free (30 searches/min, 150 URLs/min, no card), so costUsd is 0.
// Cold runs: neither API documents a no-cache option, so none is set.
import { Effect, Schema } from 'effect'
import { type HttpClient, HttpClientRequest, HttpClientResponse } from 'effect/http'
import type { Provider } from './model.ts'
import { fail, type Post } from './peers.ts'

const SearchOut = Schema.Struct({
  results: Schema.Array(
    Schema.Struct({
      url: Schema.String,
      title: Schema.optionalKey(Schema.String),
      snippet: Schema.optionalKey(Schema.String),
    }),
  ),
})
const FetchOut = Schema.Struct({
  results: Schema.Array(Schema.Struct({ url: Schema.String, text: Schema.String })),
})

const output = (text: string, urls: string[], sentBytes: number) => ({
  text,
  urls,
  citations: [],
  costUsd: 0,
  sentBytes,
})

const search = (client: HttpClient.HttpClient, key: string, query: string) =>
  client
    .execute(
      HttpClientRequest.get('https://api.search.tinyfish.ai').pipe(
        HttpClientRequest.setUrlParams({ query }),
        HttpClientRequest.setHeaders({ 'x-api-key': key }),
      ),
    )
    .pipe(
      Effect.flatMap(HttpClientResponse.filterStatusOk),
      Effect.flatMap((res) => res.json),
      Effect.flatMap(Schema.decodeUnknownEffect(SearchOut)),
      Effect.timeout('90 seconds'),
      Effect.mapError(fail),
      Effect.map((r) => {
        const text = r.results.map((h) => `${h.title ?? ''}\n${h.url}\n${h.snippet ?? ''}`)
        const urls = r.results.map((h) => h.url)
        return output(text.join('\n\n'), urls, 0)
      }),
    )

export const tinyfish = (
  post: Post,
  key: string,
  client: HttpClient.HttpClient,
): Provider['jobs'] => ({
  search: ({ query = '' }) => search(client, key, query),
  scrape: ({ url = '' }) =>
    post(
      'https://api.fetch.tinyfish.ai',
      { 'x-api-key': key },
      { urls: [url], format: 'markdown' },
      FetchOut,
    ).pipe(
      Effect.map(({ r, sentBytes }) =>
        output(r.results.map((p) => p.text).join('\n\n'), [url], sentBytes),
      ),
    ),
})
