// Deterministic BFS contract (A2/A3/B14): identical remote content ⇒ identical
// {pages, errors} — order AND membership — regardless of network timing. The
// fixture injects random per-request latency to prove completion order is out
// of the picture; URL-variant hrefs prove normalize-before-dedup.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { bfsCrawl } from '../../src/lib/crawl.ts'
import { type Fixture, type Routes, startFixture } from '../_support/fixture.ts'

function html(title: string, links: string[]): Response {
  const anchors = links.map((href) => `<a href="${href}">${href}</a>`).join('')
  return new Response(
    `<!doctype html><html><head><title>${title}</title></head><body><h1>${title}</h1><p>Body of ${title} with enough prose for extraction.</p>${anchors}</body></html>`,
    { headers: { 'content-type': 'text/html' } },
  )
}

const jittered =
  (title: string, links: string[] = []) =>
  async (): Promise<Response> => {
    await Bun.sleep(Math.random() * 80)
    return html(title, links)
  }

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

let fx: Fixture
beforeAll(() => {
  fx = startFixture(siteRoutes)
})
afterAll(() => fx.stop())

const OPTS = { limit: 100, depth: 3, concurrency: 4 }

describe('bfsCrawl — deterministic order, membership and errors', () => {
  test('two runs under random latency are deeply equal', async () => {
    const first = await bfsCrawl(`${fx.origin}/`, OPTS)
    const second = await bfsCrawl(`${fx.origin}/`, OPTS)
    expect(second).toEqual(first)
  }, 30_000)

  test('pages follow BFS discovery order, not completion order', async () => {
    const { pages, errors } = await bfsCrawl(`${fx.origin}/`, OPTS)
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
  }, 30_000)

  test('URL variants (fragment, case, explicit port) crawl once', async () => {
    const local = startFixture(siteRoutes)
    try {
      await bfsCrawl(`${local.origin}/`, OPTS)
      expect(local.hits('/a')).toBe(1)
      expect(local.hits('/b')).toBe(1)
    } finally {
      local.stop()
    }
  }, 30_000)

  test('the limit cut is a deterministic prefix', async () => {
    const limited = { ...OPTS, limit: 3 }
    const first = await bfsCrawl(`${fx.origin}/`, limited)
    const second = await bfsCrawl(`${fx.origin}/`, limited)
    const expected = [`${fx.origin}/`, `${fx.origin}/a`, `${fx.origin}/b`]
    expect(first.pages.map((p) => p.url)).toEqual(expected)
    expect(second.pages.map((p) => p.url)).toEqual(expected)
  }, 30_000)

  test('depth 0 crawls exactly the root', async () => {
    const { pages } = await bfsCrawl(`${fx.origin}/`, { ...OPTS, depth: 0 })
    expect(pages.map((p) => p.url)).toEqual([`${fx.origin}/`])
  }, 15_000)

  test('concurrency does not change the result', async () => {
    const wide = await bfsCrawl(`${fx.origin}/`, OPTS)
    const narrow = await bfsCrawl(`${fx.origin}/`, { ...OPTS, concurrency: 1 })
    expect(wide).toEqual(narrow)
  }, 30_000)

  test('a cross-host redirect of the ROOT URL re-anchors the crawl (apex→www pattern)', async () => {
    // 127.0.0.1 and localhost are different hostnames for the same fixture —
    // the root is the user's explicit target, so its redirect must be followed
    // and the crawl scope re-anchored to the final host.
    const local = startFixture(
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
    try {
      const { pages, errors } = await bfsCrawl(`${local.origin}/enter`, OPTS)
      expect(errors).toEqual([])
      expect(pages.map((p) => p.title)).toEqual(['WwwRoot', 'WwwAlpha'])
      expect(pages.every((p) => p.url.includes('localhost'))).toBe(true)
    } finally {
      local.stop()
    }
  }, 30_000)
})
