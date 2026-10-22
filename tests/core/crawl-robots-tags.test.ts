// Contract for page-level robots directives: X-Robots-Tag headers and meta
// robots tags. noindex keeps a page out of the results, nofollow keeps its
// links out of the frontier, and a rule aimed at another bot is ignored.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { crawl, type FetchResponse } from '../../src/lib/polite-crawler.ts'

const page = (body: string, headers: Record<string, string> = {}): FetchResponse => ({
  status: 200,
  body,
  headers,
})
const SITE: Record<string, FetchResponse> = {
  'https://s.test/robots.txt': { status: 404, body: '', headers: {} },
  'https://s.test/': page(
    '<p>Home of the lighthouse keepers.</p><a href="/a">A</a><a href="/b">B</a><a href="/c">C</a><a href="/d">D</a>',
  ),
  'https://s.test/a': page('<p>Granite quarries hum.</p><a href="/a2">A2</a>', {
    'x-robots-tag': 'noindex',
  }),
  'https://s.test/a2': page('<p>Violin makers in Cremona.</p>'),
  'https://s.test/b': page(
    '<meta name="robots" content="nofollow"><p>Saffron harvest in autumn.</p><a href="/b2">B2</a>',
  ),
  'https://s.test/b2': page('<p>Never reached by the crawler.</p>'),
  'https://s.test/c': page('<p>Glacier melt feeds rivers.</p>', {
    'x-robots-tag': 'googlebot: noindex',
  }),
  'https://s.test/d': page(
    '<meta name="ROBOTS" content="noindex, nofollow"><p>Tram depots at night.</p><a href="/d2">D2</a>',
  ),
  'https://s.test/d2': page('<p>Never reached either.</p>'),
}

test('noindex pages stay out of results, nofollow pages add no links', () => {
  const fetched: string[] = []
  const result = Effect.runSync(
    crawl({
      dbPath: ':memory:',
      seeds: ['https://s.test/'],
      concurrency: 1,
      minDelayMs: 0,
      fetch: (url) =>
        Effect.sync(() => {
          fetched.push(url)
          return SITE[url] ?? { status: 404, body: '', headers: {} }
        }),
    }),
  )
  expect(result.pages.map((p) => p.url).sort()).toEqual([
    'https://s.test/',
    'https://s.test/a2',
    'https://s.test/b',
    'https://s.test/c',
  ])
  expect(result.skipped.map((s) => `${s.url} ${s.reason}`).sort()).toEqual([
    'https://s.test/a noindex',
    'https://s.test/d noindex',
  ])
  expect(fetched).not.toContain('https://s.test/b2')
  expect(fetched).not.toContain('https://s.test/d2')
})
