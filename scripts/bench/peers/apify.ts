// Apify adapter: one Actor, apify/website-content-crawler, run synchronously
// through `POST /v2/acts/apify~website-content-crawler/run-sync-get-dataset-items`
// with the token in the Authorization header (Bearer), never the URL.
// Docs: https://apify.com/apify/website-content-crawler/api and
// https://docs.apify.com/api (read 2026-10-21).
// Pricing: https://apify.com/pricing (free plan $5 / month, no card; $0.2 per
// compute unit). The run reports no cost, so the price is an estimate.
// Cold runs: one page, no crawl, cheerio crawler, no sitemaps or llms.txt.
import { Effect, Schema } from 'effect'
import type { HttpClient } from 'effect/http'
import type { Provider } from './model.ts'
import type { Post } from './peers.ts'

const API = 'https://api.apify.com/v2/acts/apify~website-content-crawler/run-sync-get-dataset-items'
// ponytail: flat 0.05 compute unit per one-page run; read run usage when cost matters.
const SCRAPE_USD = 0.05 * 0.2

const Items = Schema.Array(Schema.Struct({ url: Schema.String, text: Schema.String }))

const input = (url: string) => ({
  startUrls: [{ url }],
  crawlerType: 'cheerio',
  maxCrawlPages: 1,
  maxCrawlDepth: 0,
  useSitemaps: false,
  useLlmsTxt: false,
})

export const apify = (
  post: Post,
  key: string,
  _client: HttpClient.HttpClient,
): Provider['jobs'] => ({
  scrape: ({ url = '' }) =>
    post(API, { authorization: `Bearer ${key}` }, input(url), Items).pipe(
      Effect.map(({ r, sentBytes }) => ({
        text: r.map((i) => i.text).join('\n\n'),
        urls: r.length ? r.map((i) => i.url) : [url],
        citations: [],
        costUsd: SCRAPE_USD,
        sentBytes,
      })),
    ),
})
