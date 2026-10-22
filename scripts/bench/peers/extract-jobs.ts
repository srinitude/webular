// Extract job adapter: Firecrawl POST /v2/scrape with a JSON format and schema
// (synchronous, no polling). The JSON comes back as text for the contains checks.
import { Effect, Schema } from 'effect'
import { extractSpecs } from './extract-tasks.ts'
import type { Output, Provider } from './model.ts'
import { fail, type Post } from './peers.ts'

// Firecrawl scrape: 1 credit at $83 / 100,000; the JSON format adds 4 credits.
const FIRECRAWL_EXTRACT_USD = (5 * 83) / 100_000

type Jobs = Provider['jobs']
const FcJson = Schema.Struct({ data: Schema.Struct({ json: Schema.Unknown }) })

const schemaOf = (names: readonly string[]) => ({
  type: 'object',
  properties: Object.fromEntries(names.map((n) => [n, { type: 'string' }])),
})

export const extracted = (
  data: unknown,
  url: string,
  costUsd: number,
  sentBytes: number,
): Output => ({
  text: JSON.stringify(data),
  urls: [url],
  citations: [],
  costUsd,
  sentBytes,
})

export const firecrawlExtract = (post: Post, key: string): Jobs => ({
  extract: ({ url = '' }) => {
    const spec = extractSpecs[url]
    if (!spec) return Effect.fail(fail(`no extract spec for ${url}`))
    return post(
      'https://api.firecrawl.dev/v2/scrape',
      { authorization: `Bearer ${key}` },
      { url, formats: [{ type: 'json', schema: schemaOf(spec.names) }] },
      FcJson,
    ).pipe(
      Effect.map(({ r, sentBytes }) =>
        extracted(r.data.json, url, FIRECRAWL_EXTRACT_USD, sentBytes),
      ),
    )
  },
})
