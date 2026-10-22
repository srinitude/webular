// MAP contract (B11/B12/B15): origin-root sitemap resolution, one-level
// sitemapindex recursion in child order with surfaced child failures, and
// normalized dedup of discovered links.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { mapWorkflow } from '../../src/workflows/map.ts'
import { type Routes, startFixture } from '../_support/fixture.ts'
import { eff, io } from '../_support/run.ts'

function xml(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`, {
    headers: { 'content-type': 'application/xml' },
  })
}

function page(links: string[]): Response {
  const anchors = links.map((href) => `<a href="${href}">${href}</a>`).join('')
  return new Response(
    `<!doctype html><html><head><title>t</title></head><body>${anchors}</body></html>`,
    {
      headers: { 'content-type': 'text/html' },
    },
  )
}

const urlset = (locs: string[]): string =>
  `<urlset>${locs.map((l) => `<url><loc>${l}</loc></url>`).join('')}</urlset>`

interface MapResult {
  links: string[]
  errors: { url: string; reason: string }[]
  count: number
}

const runMap = (url: string) =>
  Effect.gen(function* () {
    const run = yield* io(() => mapWorkflow.createRun({ runId: 'map-test' }))
    const outcome = yield* io(() => run.start({ inputData: { url } }))
    if (outcome.status !== 'success')
      return yield* Effect.fail(new Error(`map failed: ${outcome.status}`))
    return outcome.result as MapResult
  })

describe('map — sitemap discovery', () => {
  test(
    'resolves the sitemap at the ORIGIN root, not path-relative (B11)',
    eff(
      Effect.gen(function* () {
        const fx = yield* startFixture(
          (origin): Routes => ({
            '/sitemap.xml': () => xml(urlset([`${origin}/a`, `${origin}/b`])),
            '/deep/page': () => page(['/z1', '/z2']),
          }),
        )
        const { links, errors } = yield* runMap(`${fx.origin}/deep/page`)
        expect(links).toEqual([`${fx.origin}/a`, `${fx.origin}/b`])
        expect(errors).toEqual([])
        expect(fx.hits('/sitemap.xml')).toBe(1)
      }),
    ),
    15_000,
  )

  test(
    'lists pages from a sitemap whose locs are relative paths',
    eff(
      Effect.gen(function* () {
        const fx = yield* startFixture(
          (): Routes => ({
            '/sitemap.xml': () => xml(urlset(['index.html', 'a/p1.html', '/b/p2.html'])),
          }),
        )
        const { links } = yield* runMap(`${fx.origin}/`)
        expect(links).toEqual([
          `${fx.origin}/index.html`,
          `${fx.origin}/a/p1.html`,
          `${fx.origin}/b/p2.html`,
        ])
      }),
    ),
    15_000,
  )

  test(
    'recurses one sitemapindex level in child order and surfaces child failures (B12)',
    eff(
      Effect.gen(function* () {
        const fx = yield* startFixture(
          (origin): Routes => ({
            '/sitemap.xml': () =>
              xml(
                `<sitemapindex><sitemap><loc>${origin}/sm-1.xml</loc></sitemap><sitemap><loc>${origin}/sm-404.xml</loc></sitemap><sitemap><loc>${origin}/sm-2.xml</loc></sitemap></sitemapindex>`,
              ),
            '/sm-1.xml': () => xml(urlset([`${origin}/p1`, `${origin}/p2`])),
            '/sm-2.xml': () => xml(urlset([`${origin}/p3`, `${origin}/p1#dup`])),
          }),
        )
        const { links, errors } = yield* runMap(fx.origin)
        expect(links).toEqual([`${fx.origin}/p1`, `${fx.origin}/p2`, `${fx.origin}/p3`])
        expect(errors).toEqual([
          { url: `${fx.origin}/sm-404.xml`, reason: expect.stringContaining('404') },
        ])
      }),
    ),
    15_000,
  )

  test(
    'falls back to page links with normalized dedup (B15)',
    eff(
      Effect.gen(function* () {
        const fx = yield* startFixture(
          (origin): Routes => ({
            '/': () => page(['/x', '/x#f', `${origin.toUpperCase()}/x`, '/y']),
          }),
        )
        const { links, count } = yield* runMap(fx.origin)
        expect(links).toEqual([`${fx.origin}/x`, `${fx.origin}/y`])
        expect(count).toBe(2)
      }),
    ),
    15_000,
  )
})

const text = (body: string): Response =>
  new Response(body, { headers: { 'content-type': 'text/plain' } })

describe('map — relative robots.txt Sitemap: line', () => {
  test(
    'follows a relative robots.txt Sitemap: line and its relative locs',
    eff(
      Effect.gen(function* () {
        const fx = yield* startFixture(
          (): Routes => ({
            '/robots.txt': () => text('Sitemap: /maps/site.xml\n'),
            '/maps/site.xml': () => xml(urlset(['r1', '/r2'])),
            '/': () => page(['/crawled']),
          }),
        )
        const { links } = yield* runMap(fx.origin)
        expect(links).toEqual([`${fx.origin}/maps/r1`, `${fx.origin}/r2`])
      }),
    ),
    15_000,
  )
})

describe('map — robots.txt Sitemap: fallback', () => {
  test(
    'uses robots.txt Sitemap: entries when /sitemap.xml is missing',
    eff(
      Effect.gen(function* () {
        const fx = yield* startFixture(
          (origin): Routes => ({
            '/robots.txt': () =>
              text(`User-agent: *\nDisallow:\nSITEMAP: ${origin}/custom-sitemap.xml\n`),
            '/custom-sitemap.xml': () => xml(urlset([`${origin}/r1`, `${origin}/r2`])),
            '/': () => page(['/crawled']),
          }),
        )
        const { links, errors } = yield* runMap(fx.origin)
        expect(links).toEqual([`${fx.origin}/r1`, `${fx.origin}/r2`])
        expect(errors).toEqual([])
        expect(fx.hits('/sitemap.xml')).toBe(1)
      }),
    ),
    15_000,
  )

  test(
    'ignores off-host robots.txt sitemaps and falls back to page links',
    eff(
      Effect.gen(function* () {
        const fx = yield* startFixture(
          (): Routes => ({
            '/robots.txt': () => text('Sitemap: http://elsewhere.invalid/sitemap.xml\n'),
            '/': () => page(['/crawled']),
          }),
        )
        const { links, errors } = yield* runMap(fx.origin)
        expect(links).toEqual([`${fx.origin}/crawled`])
        expect(errors).toEqual([])
      }),
    ),
    15_000,
  )

  test(
    'falls back to link crawl when neither sitemap nor robots.txt exists',
    eff(
      Effect.gen(function* () {
        const fx = yield* startFixture((): Routes => ({ '/': () => page(['/only']) }))
        const { links } = yield* runMap(fx.origin)
        expect(links).toEqual([`${fx.origin}/only`])
        expect(fx.hits('/robots.txt')).toBe(1)
      }),
    ),
    15_000,
  )
})
