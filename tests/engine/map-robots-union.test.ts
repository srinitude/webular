// map seeds from every robots.txt Sitemap: line, even when /sitemap.xml has links.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { mapWorkflow } from '../../src/workflows/map.ts'
import { type Routes, startFixture } from '../_support/fixture.ts'
import { eff, io } from '../_support/run.ts'

const xml = (locs: string[]) =>
  new Response(`<urlset>${locs.map((l) => `<url><loc>${l}</loc></url>`).join('')}</urlset>`, {
    headers: { 'content-type': 'application/xml' },
  })
const text = (body: string) => new Response(body, { headers: { 'content-type': 'text/plain' } })

describe('map — robots.txt Sitemap: lines join /sitemap.xml', () => {
  test(
    'unions robots-named sitemaps after /sitemap.xml, without refetching it',
    eff(
      Effect.gen(function* () {
        const fx = yield* startFixture(
          (origin): Routes => ({
            '/robots.txt': () =>
              text(`Sitemap: ${origin}/sitemap.xml\nSitemap: ${origin}/extra.xml\n`),
            '/sitemap.xml': () => xml([`${origin}/a`]),
            '/extra.xml': () => xml([`${origin}/b`, `${origin}/a`]),
          }),
        )
        const run = yield* io(() => mapWorkflow.createRun({ runId: 'map-robots-union' }))
        const out = yield* io(() => run.start({ inputData: { url: `${fx.origin}/deep` } }))
        const result = out.status === 'success' ? (out.result as { links: string[] }) : null
        expect(result?.links).toEqual([`${fx.origin}/a`, `${fx.origin}/b`])
        expect(fx.hits('/sitemap.xml')).toBe(1)
      }),
    ),
    15_000,
  )
})
