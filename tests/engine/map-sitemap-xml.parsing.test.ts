// MAP reads sitemap <loc> values the way XML defines them: entities decoded,
// CDATA unwrapped, whitespace trimmed, tags case-insensitive, comments ignored.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { mapWorkflow } from '../../src/workflows/map.ts'
import { type Routes, startFixture } from '../_support/fixture.ts'
import { eff, io } from '../_support/run.ts'

const messy = await Bun.file(new URL('../fixtures/sitemaps/messy.xml', import.meta.url)).text()

describe('map — sitemap XML details', () => {
  test(
    'decodes entities, unwraps CDATA, trims whitespace, and skips commented entries',
    eff(
      Effect.gen(function* () {
        const fx = yield* startFixture(
          (origin): Routes => ({
            '/': () =>
              new Response('<html><body>hi</body></html>', {
                headers: { 'content-type': 'text/html' },
              }),
            '/sitemap.xml': () =>
              new Response(messy.replaceAll('ORIGIN', origin), {
                headers: { 'content-type': 'application/xml' },
              }),
          }),
        )
        const run = yield* io(() => mapWorkflow.createRun({ runId: 'map-xml-test' }))
        const outcome = yield* io(() => run.start({ inputData: { url: `${fx.origin}/` } }))
        if (outcome.status !== 'success') return yield* Effect.fail(new Error(outcome.status))
        const { links } = outcome.result as { links: string[] }
        expect(links).toEqual([
          `${fx.origin}/p?a=1&b=2`,
          `${fx.origin}/cdata?x=1&y=2`,
          `${fx.origin}/spaced`,
          `${fx.origin}/q?s=%22a%20b%22&t=1`,
        ])
      }),
    ),
    15_000,
  )
})
