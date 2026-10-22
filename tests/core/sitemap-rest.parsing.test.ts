// Sitemap edge cases beyond the spec's happy path: nested indexes recurse up to a
// depth cap, a body gzipped twice is unwrapped, and namespace-prefixed tags
// (<sm:loc>) parse like plain ones. All against the local fixture server.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { mapWorkflow } from '../../src/workflows/map.ts'
import { type Routes, startFixture } from '../_support/fixture.ts'
import { eff, io } from '../_support/run.ts'

const xml = (body: string): Response =>
  new Response(body, { headers: { 'content-type': 'application/xml' } })

const urlset = (locs: string[]): string =>
  `<?xml version="1.0"?><urlset>${locs.map((l) => `<url><loc>${l}</loc></url>`).join('')}</urlset>`

const index = (locs: string[]): string =>
  `<?xml version="1.0"?><sitemapindex>${locs.map((l) => `<sitemap><loc>${l}</loc></sitemap>`).join('')}</sitemapindex>`

const html = new Response('<!doctype html><html><body>hi</body></html>', {
  headers: { 'content-type': 'text/html' },
})

const runMap = (url: string) =>
  Effect.gen(function* () {
    const run = yield* io(() => mapWorkflow.createRun({ runId: 'sitemap-rest-test' }))
    const outcome = yield* io(() => run.start({ inputData: { url } }))
    if (outcome.status !== 'success')
      return yield* Effect.fail(new Error(`map failed: ${outcome.status}`))
    return outcome.result as { links: string[]; errors: { url: string; reason: string }[] }
  })

describe('sitemap — nested index', () => {
  test(
    'a child <sitemapindex> is expanded, not read as a list of pages',
    eff(
      Effect.gen(function* () {
        const fx = yield* startFixture(
          (origin): Routes => ({
            '/': () => html.clone(),
            '/sitemap.xml': () => xml(index([`${origin}/inner.xml`])),
            '/inner.xml': () => xml(index([`${origin}/leaf.xml`])),
            '/leaf.xml': () => xml(urlset([`${origin}/deep`])),
          }),
        )
        const { links, errors } = yield* runMap(`${fx.origin}/`)
        expect(links).toContain(`${fx.origin}/deep`)
        expect(links).not.toContain(`${fx.origin}/inner.xml`)
        expect(errors).toEqual([])
      }),
    ),
    15_000,
  )

  test(
    'a self-referencing index stops at the depth cap',
    eff(
      Effect.gen(function* () {
        const fx = yield* startFixture(
          (origin): Routes => ({
            '/': () => html.clone(),
            '/sitemap.xml': () => xml(index([`${origin}/sitemap.xml`])),
          }),
        )
        const { links } = yield* runMap(`${fx.origin}/`)
        expect(links).not.toContain(`${fx.origin}/sitemap.xml`)
        expect(fx.hits('/sitemap.xml')).toBeLessThan(10)
      }),
    ),
    15_000,
  )
})

describe('sitemap — body gzipped twice', () => {
  test(
    'a double-gzip sitemap is unwrapped to its urlset',
    eff(
      Effect.gen(function* () {
        const fx = yield* startFixture(
          (origin): Routes => ({
            '/': () => html.clone(),
            '/sitemap.xml': () =>
              new Response(Bun.gzipSync(Bun.gzipSync(urlset([`${origin}/twice`]))), {
                headers: { 'content-type': 'application/gzip' },
              }),
          }),
        )
        const { links, errors } = yield* runMap(`${fx.origin}/`)
        expect(links).toContain(`${fx.origin}/twice`)
        expect(errors).toEqual([])
      }),
    ),
    15_000,
  )

  test(
    'the decompressed cap still applies to a double-gzip bomb',
    eff(
      Effect.gen(function* () {
        const bomb = Bun.gzipSync(Bun.gzipSync(new Uint8Array(26 * 1024 * 1024)))
        const fx = yield* startFixture(
          (origin): Routes => ({
            '/': () => html.clone(),
            '/robots.txt': () => new Response(`Sitemap: ${origin}/bomb.xml.gz\n`),
            '/bomb.xml.gz': () =>
              new Response(bomb, { headers: { 'content-type': 'application/gzip' } }),
          }),
        )
        const { errors } = yield* runMap(`${fx.origin}/`)
        expect(errors[0]?.reason).toContain('exceeded')
      }),
    ),
    30_000,
  )
})

describe('sitemap — namespace-prefixed tags', () => {
  test(
    'reads <sm:urlset> and <sm:sitemapindex> with <sm:loc>, ignoring <image:loc>',
    eff(
      Effect.gen(function* () {
        const ns = 'xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9"'
        const fx = yield* startFixture(
          (origin): Routes => ({
            '/': () => html.clone(),
            '/sitemap.xml': () =>
              xml(
                `<sm:sitemapindex ${ns}><sm:sitemap><sm:loc>${origin}/c.xml</sm:loc></sm:sitemap></sm:sitemapindex>`,
              ),
            '/c.xml': () =>
              xml(
                `<sm:urlset ${ns} xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"><sm:url><sm:loc>${origin}/p</sm:loc><image:image><image:loc>${origin}/pic.png</image:loc></image:image></sm:url></sm:urlset>`,
              ),
          }),
        )
        const { links, errors } = yield* runMap(`${fx.origin}/`)
        expect(links).toContain(`${fx.origin}/p`)
        expect(links).not.toContain(`${fx.origin}/pic.png`)
        expect(errors).toEqual([])
      }),
    ),
    15_000,
  )
})
