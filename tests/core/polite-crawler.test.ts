// Contract for the polite crawler: the frontier matches a reference model,
// memory stays under the cap at any crawl size, delays stay clamped,
// near-duplicates are skipped, and a resumed crawl never refetches.
import { Database } from 'bun:sqlite'
import { expect, test } from 'bun:test'
import { tmpdir } from 'node:os'
import { Effect } from 'effect'
import {
  type CrawlOptions,
  crawl,
  type FetchResponse,
  MIN_DELAY_MS,
} from '../../src/lib/polite-crawler.ts'

const LONG =
  'Tides rise and fall twice a day as the moon pulls the oceans around the planet. '.repeat(20)
const SITE: Record<string, FetchResponse> = {
  'https://s.test/robots.txt': { status: 404, body: '', headers: {} },
  'https://s.test/': {
    status: 200,
    body: '<title>Home</title><a href="/a">A</a><a href="/b">B</a><a href="/c">C</a><a href="https://other.test/x">X</a>',
    headers: {},
  },
  'https://s.test/a': { status: 200, body: `<p>${LONG} alpha</p>`, headers: {} },
  'https://s.test/b': {
    status: 200,
    body: `<div class="mirror">${LONG} alpha!</div>`,
    headers: {},
  },
  'https://s.test/c': { status: 200, body: '<p>Osmium is the densest element.</p>', headers: {} },
}

// Fake site on a virtual clock: each fetch takes 10 ms, sleeps advance time.
const fakeSite = (fetched: string[]) => {
  let t = 0
  return {
    fetch: (url: string) =>
      Effect.sync(() => {
        fetched.push(url)
        t += 10
        return SITE[url] ?? { status: 404, body: '', headers: {} }
      }),
    now: () => t,
    sleep: (ms: number) =>
      Effect.sync(() => {
        t += ms
      }),
  } satisfies Partial<CrawlOptions>
}

test('crawl: a near-duplicate page is skipped and other origins are not followed', () => {
  const fetched: string[] = []
  const result = Effect.runSync(
    crawl({ ...fakeSite(fetched), dbPath: ':memory:', seeds: ['https://s.test/'], concurrency: 2 }),
  )
  expect(result.skipped).toEqual([{ url: 'https://s.test/b', reason: 'near-duplicate' }])
  expect(result.pages.map((p) => p.url).sort()).toEqual([
    'https://s.test/',
    'https://s.test/a',
    'https://s.test/c',
  ])
  expect(fetched.some((u) => u.includes('other.test'))).toBe(false)
  expect(result.done).toBe(true)
})

test('crawl: linkWorthFollowing can drop links', () => {
  const result = Effect.runSync(
    crawl({
      ...fakeSite([]),
      dbPath: ':memory:',
      seeds: ['https://s.test/'],
      linkWorthFollowing: (_, links) => Effect.succeed(links.map((l) => !l.url.endsWith('/c'))),
    }),
  )
  expect(result.pages.some((p) => p.url.endsWith('/c'))).toBe(false)
})

test('crawl: resume after reopen continues without refetching', () => {
  const dbPath = `${tmpdir()}/polite-crawler-resume-${process.pid}.sqlite`
  const fetched: string[] = []
  const site = fakeSite(fetched)
  const first = Effect.runSync(
    crawl({ ...site, dbPath, seeds: ['https://s.test/'], maxPages: 2, concurrency: 1 }),
  )
  expect(first.done).toBe(false)
  const second = Effect.runSync(
    crawl({ ...site, dbPath, resume: first.resumeToken, concurrency: 1 }),
  )
  expect(second.done).toBe(true)
  const pages = fetched.filter((u) => !u.endsWith('/robots.txt'))
  expect(pages.length).toBe(4)
  expect(new Set(pages).size).toBe(4)
})

test('crawl: resume keeps fingerprints, host delays, and the robots cache', () => {
  const dbPath = `${tmpdir()}/polite-crawler-state-${process.pid}.sqlite`
  const fetched: string[] = []
  const site = fakeSite(fetched)
  const first = Effect.runSync(
    crawl({ ...site, dbPath, seeds: ['https://s.test/'], maxPages: 2, concurrency: 1 }),
  )
  expect(first.pages.map((p) => p.url)).toEqual(['https://s.test/', 'https://s.test/a'])
  const second = Effect.runSync(
    crawl({ ...site, dbPath, resume: first.resumeToken, concurrency: 1 }),
  )
  // b mirrors a, which only the first run saw: the restored fingerprint catches it.
  expect(second.skipped).toEqual([{ url: 'https://s.test/b', reason: 'near-duplicate' }])
  expect(fetched.filter((u) => u.endsWith('/robots.txt')).length).toBe(1)
  const db = new Database(dbPath)
  const row = db.query('SELECT ms FROM crawl_delays WHERE token = ?').get(first.resumeToken)
  db.close()
  expect((row as { ms: number }).ms).toBeGreaterThanOrEqual(MIN_DELAY_MS)
})
