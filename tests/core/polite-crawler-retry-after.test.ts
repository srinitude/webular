// Contract: a host that answers 429 with Retry-After is not hit again before
// that wait (within MAX_DELAY_MS), on the crawler's virtual clock.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { crawl, type FetchResponse } from '../../src/lib/polite-crawler.ts'

const SITE: Record<string, FetchResponse> = {
  'https://r.test/robots.txt': { status: 404, body: '', headers: {} },
  'https://r.test/a': { status: 429, body: '', headers: { 'retry-after': '2' } },
  'https://r.test/b': { status: 200, body: '<p>Basalt cools into columns.</p>', headers: {} },
}

test('crawl: the next request to a host waits out its 429 Retry-After', () => {
  let t = 0
  const hits: Array<{ url: string; at: number }> = []
  Effect.runSync(
    crawl({
      dbPath: ':memory:',
      seeds: ['https://r.test/a', 'https://r.test/b'],
      concurrency: 1,
      now: () => t,
      sleep: (ms) =>
        Effect.sync(() => {
          t += ms
        }),
      fetch: (url) =>
        Effect.sync(() => {
          hits.push({ url, at: t })
          t += 10
          return SITE[url] ?? { status: 404, body: '', headers: {} }
        }),
    }),
  )
  const limited = hits.findIndex((h) => h.url === 'https://r.test/a')
  const after = hits[limited + 1]
  expect(after).toBeDefined()
  expect((after?.at ?? 0) - (hits[limited]?.at ?? 0)).toBeGreaterThanOrEqual(2000)
})
