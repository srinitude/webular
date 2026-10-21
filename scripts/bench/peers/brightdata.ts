// Bright Data adapter: one endpoint, POST https://api.brightdata.com/request
// (Bearer API key), routed by zone. Search goes through a SERP API zone with a
// Google URL plus `brd_json=1` for parsed JSON; scrape goes through a Web
// Unlocker zone with `format: json` and `data_format: markdown`.
// Docs: https://docs.brightdata.com/scraping-automation/serp-api/send-your-first-request
// and https://docs.brightdata.com/scraping-automation/web-unlocker/send-your-first-request
// (read 2026-10-21).
// Zones: env BRIGHTDATA_SERP_ZONE (default `serp_api1`) and
// BRIGHTDATA_UNLOCKER_ZONE (default `web_unlocker1`), the names the control
// panel gives the first zone of each kind.
// Free terms: 5,000 SERP requests per month, no card. Pricing:
// https://brightdata.com/pricing/serp and https://brightdata.com/pricing/web-unlocker
// (pay as you go $1.50 / 1,000 successful requests for each).
import { Config, Effect, Schema } from 'effect'
import type { HttpClient } from 'effect/http'
import type { Provider } from './model.ts'
import { fail, type Post } from './peers.ts'

const API = 'https://api.brightdata.com/request'
const CALL_USD = 0.0015

const SerpReply = Schema.Struct({
  organic: Schema.Array(
    Schema.Struct({
      link: Schema.String,
      title: Schema.optionalKey(Schema.String),
      description: Schema.optionalKey(Schema.String),
    }),
  ),
})
const PageReply = Schema.Struct({ status_code: Schema.Number, body: Schema.String })

const zone = (name: string, fallback: string) =>
  Effect.gen(function* () {
    return yield* Config.String(name).pipe(Config.withDefault(fallback))
  }).pipe(Effect.mapError(fail))

const page = (text: string, urls: string[], sentBytes: number) => ({
  text,
  urls,
  citations: [],
  costUsd: CALL_USD,
  sentBytes,
})

const search = (post: Post, auth: Record<string, string>, query: string) =>
  Effect.gen(function* () {
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=5&brd_json=1`
    const body = { zone: yield* zone('BRIGHTDATA_SERP_ZONE', 'serp_api1'), url, format: 'raw' }
    const { r, sentBytes } = yield* post(API, auth, body, SerpReply)
    const text = r.organic.map((h) => `${h.title ?? ''}\n${h.link}\n${h.description ?? ''}`)
    return page(
      text.join('\n\n'),
      r.organic.map((h) => h.link),
      sentBytes,
    )
  })

const scrape = (post: Post, auth: Record<string, string>, url: string) =>
  Effect.gen(function* () {
    const z = yield* zone('BRIGHTDATA_UNLOCKER_ZONE', 'web_unlocker1')
    const body = { zone: z, url, format: 'json', data_format: 'markdown' }
    const { r, sentBytes } = yield* post(API, auth, body, PageReply)
    return page(r.body, [url], sentBytes)
  })

export const brightdata = (
  post: Post,
  key: string,
  _client: HttpClient.HttpClient,
): Provider['jobs'] => {
  const auth = { authorization: `Bearer ${key}` }
  return {
    search: ({ query = '' }) => search(post, auth, query),
    scrape: ({ url = '' }) => scrape(post, auth, url),
  }
}
