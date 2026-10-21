// ScrapeGraphAI adapter: SmartScraper (`POST /v1/smartscraper`, SGAI-APIKEY).
// Docs: https://docs.scrapegraphai.com/services/smartscraper (read 2026-10-21).
// Pricing: https://scrapegraphai.com/pricing (Starter $20 / 10,000 credits;
// SmartScraper 10 credits per page; free 500 credits once, 10 req/min, no card).
// The endpoint has no cache option; stealth stays off (+5 credits).
import { Effect, Schema } from 'effect'
import type { HttpClient } from 'effect/http'
import type { Provider } from './model.ts'
import type { Post } from './peers.ts'

const API = 'https://api.scrapegraphai.com/v1/smartscraper'
const SCRAPE_USD = 10 * (20 / 10_000)
const PROMPT = 'Return the full main text content of the page, verbatim.'

const Reply = Schema.Struct({ result: Schema.Unknown })

const asText = (result: unknown) => (typeof result === 'string' ? result : JSON.stringify(result))

export const scrapegraph = (
  post: Post,
  key: string,
  _client: HttpClient.HttpClient,
): Provider['jobs'] => ({
  scrape: ({ url = '' }) =>
    post(API, { 'SGAI-APIKEY': key }, { website_url: url, user_prompt: PROMPT }, Reply).pipe(
      Effect.map(({ r, sentBytes }) => ({
        text: asText(r.result),
        urls: [url],
        citations: [],
        costUsd: SCRAPE_USD,
        sentBytes,
      })),
    ),
})
