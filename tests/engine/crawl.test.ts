// Deterministic BFS contract (A2/A3/B14): identical remote content ⇒ identical
// {pages, errors} — order AND membership — regardless of network timing. The
// fixture injects random per-request latency to prove completion order is out
// of the picture; URL-variant hrefs prove normalize-before-dedup.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { bfsCrawl } from '../../src/lib/crawl.ts'
import { openLocalIndex, searchLocal } from '../../src/lib/local-index.ts'
import { type Routes, startFixture, useFixture } from '../_support/fixture.ts'
import { eff, tmpDir } from '../_support/run.ts'

function html(title: string, links: string[]): Response {
  const anchors = links.map((href) => `<a href="${href}">${href}</a>`).join('')
  return new Response(
    `<!doctype html><html><head><title>${title}</title></head><body><h1>${title}</h1><p>Body of ${title} with enough prose for extraction.</p>${anchors}</body></html>`,
    { headers: { 'content-type': 'text/html' } },
  )
}

const jittered =
  (title: string, links: string[] = []) =>
  (): Effect.Effect<Response> =>
    Effect.sleep(Math.random() * 12).pipe(Effect.as(html(title, links)))

function siteRoutes(origin: string): Routes {
  const upper = origin.toUpperCase().replace('HTTP://', 'HTTP://')
  return {
    '/': jittered('Root', [
      '/a',
      '/b#frag',
      '/b',
      `${upper}/a`,
      '/c',
      '/missing',
      'http://offsite.invalid/x',
    ]),
    '/a': jittered('Alpha', ['/d']),
    '/b': jittered('Beta', ['/d', '/e']),
    '/c': jittered('Gamma'),
    '/d': jittered('Delta'),
    '/e': jittered('Epsilon'),
  }
}

const fx = useFixture(siteRoutes)

const OPTS = { limit: 100, depth: 3, concurrency: 4, minDelayMs: 5 }

describe('bfsCrawl — deterministic order, membership and errors', () => {
  test(
    'two runs under random latency are deeply equal',
    eff(
      Effect.gen(function* () {
        const first = yield* bfsCrawl(`${fx.origin}/`, OPTS)
        const second = yield* bfsCrawl(`${fx.origin}/`, OPTS)
        expect(second).toEqual(first)
      }),
    ),
    30_000,
  )

  test(
    'pages follow BFS discovery order, not completion order',
    eff(
      Effect.gen(function* () {
        const { pages, errors } = yield* bfsCrawl(`${fx.origin}/`, OPTS)
        expect(pages.map((p) => p.url)).toEqual([
          `${fx.origin}/`,
          `${fx.origin}/a`,
          `${fx.origin}/b`,
          `${fx.origin}/c`,
          `${fx.origin}/d`,
          `${fx.origin}/e`,
        ])
        expect(errors).toEqual([
          { url: `${fx.origin}/missing`, reason: expect.stringContaining('404') },
        ])
      }),
    ),
    30_000,
  )

  test(
    'URL variants (fragment, case, explicit port) crawl once',
    eff(
      Effect.gen(function* () {
        const local = yield* startFixture(siteRoutes)
        yield* bfsCrawl(`${local.origin}/`, OPTS)
        expect(local.hits('/a')).toBe(1)
        expect(local.hits('/b')).toBe(1)
      }),
    ),
    30_000,
  )

  test(
    'the limit cut is a deterministic prefix',
    eff(
      Effect.gen(function* () {
        const limited = { ...OPTS, limit: 3 }
        const first = yield* bfsCrawl(`${fx.origin}/`, limited)
        const second = yield* bfsCrawl(`${fx.origin}/`, limited)
        const expected = [`${fx.origin}/`, `${fx.origin}/a`, `${fx.origin}/b`]
        expect(first.pages.map((p) => p.url)).toEqual(expected)
        expect(second.pages.map((p) => p.url)).toEqual(expected)
      }),
    ),
    30_000,
  )

  test(
    'depth 0 crawls exactly the root',
    eff(
      Effect.gen(function* () {
        const { pages } = yield* bfsCrawl(`${fx.origin}/`, { ...OPTS, depth: 0 })
        expect(pages.map((p) => p.url)).toEqual([`${fx.origin}/`])
      }),
    ),
    15_000,
  )

  test(
    'concurrency does not change the result',
    eff(
      Effect.gen(function* () {
        const wide = yield* bfsCrawl(`${fx.origin}/`, OPTS)
        const narrow = yield* bfsCrawl(`${fx.origin}/`, { ...OPTS, concurrency: 1 })
        expect(wide).toEqual(narrow)
      }),
    ),
    30_000,
  )

  test(
    'a cross-host redirect of the ROOT URL re-anchors the crawl (apex→www pattern)',
    eff(
      Effect.gen(function* () {
        // 127.0.0.1 and localhost are different hostnames for the same fixture —
        // the root is the user's explicit target, so its redirect must be followed
        // and the crawl scope re-anchored to the final host.
        const local = yield* startFixture(
          (origin): Routes => ({
            '/enter': () =>
              new Response(null, {
                status: 302,
                headers: { location: origin.replace('127.0.0.1', 'localhost') },
              }),
            '/': jittered('WwwRoot', ['/a']),
            '/a': jittered('WwwAlpha'),
          }),
        )
        const { pages, errors } = yield* bfsCrawl(`${local.origin}/enter`, OPTS)
        expect(errors).toEqual([])
        expect(pages.map((p) => p.title)).toEqual(['WwwRoot', 'WwwAlpha'])
        expect(pages.every((p) => p.url.includes('localhost'))).toBe(true)
      }),
    ),
    30_000,
  )
})

// Points the local index at `dir` for the scope, then restores the saved env.
const indexEnv = (dir: string) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const saved = {
        off: process.env['WEBULAR_NO_CACHE'],
        dir: process.env['WEBULAR_CACHE_DIR'],
      }
      process.env['WEBULAR_NO_CACHE'] = '0'
      process.env['WEBULAR_CACHE_DIR'] = dir
      return saved
    }),
    (saved) =>
      Effect.sync(() => {
        process.env['WEBULAR_NO_CACHE'] = saved.off ?? '1'
        if (saved.dir === undefined) delete process.env['WEBULAR_CACHE_DIR']
        else process.env['WEBULAR_CACHE_DIR'] = saved.dir
      }),
  )

test(
  'every crawled page lands in the local index',
  eff(
    Effect.gen(function* () {
      const dir = yield* tmpDir('crawl-index-')
      yield* indexEnv(dir)
      const { pages } = yield* bfsCrawl(`${fx.origin}/`, { ...OPTS, depth: 1 })
      const index = yield* openLocalIndex(`${dir}/local-index.sqlite`)
      const hits = yield* searchLocal(index, 'Gamma', 5)
      expect(pages.map((p) => p.url)).toContain(`${fx.origin}/c`)
      expect(hits.map((h) => h.url)).toEqual([`${fx.origin}/c`])
    }),
  ),
  30_000,
)
