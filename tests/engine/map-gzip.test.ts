// MAP reads gzip sitemaps (.xml.gz) and gzip sitemap indexes, and the byte cap
// counts DECOMPRESSED bytes, so a small gzip bomb is refused.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { mapWorkflow } from '../../src/workflows/map.ts'
import { type Routes, startFixture } from '../_support/fixture.ts'
import { eff, io } from '../_support/run.ts'

const gz = (text: string): Response =>
  new Response(Bun.gzipSync(text), { headers: { 'content-type': 'application/gzip' } })

const urlset = (locs: string[]): string =>
  `<?xml version="1.0"?><urlset>${locs.map((l) => `<url><loc>${l}</loc></url>`).join('')}</urlset>`

const index = (locs: string[]): string =>
  `<?xml version="1.0"?><sitemapindex>${locs.map((l) => `<sitemap><loc>${l}</loc></sitemap>`).join('')}</sitemapindex>`

const html = new Response('<!doctype html><html><body>hi</body></html>', {
  headers: { 'content-type': 'text/html' },
})

interface MapResult {
  links: string[]
  errors: { url: string; reason: string }[]
}

const runMap = (url: string) =>
  Effect.gen(function* () {
    const run = yield* io(() => mapWorkflow.createRun({ runId: 'map-gzip-test' }))
    const outcome = yield* io(() => run.start({ inputData: { url } }))
    if (outcome.status !== 'success')
      return yield* Effect.fail(new Error(`map failed: ${outcome.status}`))
    return outcome.result as MapResult
  })

describe('map — gzip sitemaps', () => {
  test(
    'reads a gzip sitemap named by robots.txt',
    eff(
      Effect.gen(function* () {
        const fx = yield* startFixture(
          (origin): Routes => ({
            '/': () => html.clone(),
            '/robots.txt': () => new Response(`Sitemap: ${origin}/sm.xml.gz\n`),
            '/sm.xml.gz': () => gz(urlset([`${origin}/a`, `${origin}/b`])),
          }),
        )
        const { links, errors } = yield* runMap(`${fx.origin}/`)
        expect(links).toEqual(expect.arrayContaining([`${fx.origin}/a`, `${fx.origin}/b`]))
        expect(errors).toEqual([])
      }),
    ),
    15_000,
  )

  test(
    'reads a gzip sitemap index whose children are .xml.gz and plain xml',
    eff(
      Effect.gen(function* () {
        const fx = yield* startFixture(
          (origin): Routes => ({
            '/sitemap.xml': () => gz(index([`${origin}/c1.xml.gz`, `${origin}/c2.xml`])),
            '/c1.xml.gz': () => gz(urlset([`${origin}/one`])),
            '/c2.xml': () =>
              new Response(urlset([`${origin}/two`]), {
                headers: { 'content-type': 'application/xml' },
              }),
          }),
        )
        const { links, errors } = yield* runMap(`${fx.origin}/`)
        expect(links).toEqual([`${fx.origin}/one`, `${fx.origin}/two`])
        expect(errors).toEqual([])
      }),
    ),
    15_000,
  )

  test(
    'refuses a gzip bomb: 26 MB of zeros in a few KB stops at the decompressed byte cap',
    eff(
      Effect.gen(function* () {
        const bomb = Bun.gzipSync(new Uint8Array(26 * 1024 * 1024))
        expect(bomb.byteLength).toBeLessThan(100_000)
        const fx = yield* startFixture(
          (origin): Routes => ({
            '/': () => html.clone(),
            '/robots.txt': () => new Response(`Sitemap: ${origin}/bomb.xml.gz\n`),
            '/bomb.xml.gz': () =>
              new Response(bomb, { headers: { 'content-type': 'application/gzip' } }),
          }),
        )
        const { errors } = yield* runMap(`${fx.origin}/`)
        expect(errors.map((e) => e.url)).toEqual([`${fx.origin}/bomb.xml.gz`])
        expect(errors[0]?.reason).toContain('exceeded')
      }),
    ),
    30_000,
  )
})
