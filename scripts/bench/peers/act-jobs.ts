// Act job adapter: Firecrawl POST /v2/scrape with browser actions (click the
// reveal button, wait), then the page markdown as text for the contains check.
import { Effect, Schema } from 'effect'
import type { Provider } from './model.ts'
import { out, type Post } from './peers.ts'

// Firecrawl scrape: 1 credit at $83 / 100,000.
const FIRECRAWL_ACT_USD = 83 / 100_000

const FcAct = Schema.Struct({ data: Schema.Struct({ markdown: Schema.String }) })

export const firecrawlAct = (post: Post, key: string): Provider['jobs'] => ({
  act: ({ url = '' }) =>
    post(
      'https://api.firecrawl.dev/v2/scrape',
      { authorization: `Bearer ${key}` },
      {
        url,
        formats: ['markdown'],
        actions: [
          { type: 'click', selector: '#reveal' },
          { type: 'wait', milliseconds: 500 },
        ],
      },
      FcAct,
    ).pipe(
      Effect.map(({ r, sentBytes }) => out(r.data.markdown, [url], FIRECRAWL_ACT_USD, sentBytes)),
    ),
})
