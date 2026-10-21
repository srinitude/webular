// CRAWL free-source chain, second source: Common Crawl's index is down (its
// collinfo answers 503), so the Wayback CDX lists the site's pages. The CDX
// body is the recorded wayback-cdx.json with its two original URLs swapped for
// the fixture's pages. The root 404s. No mocks, no live network.
import { describe, expect, test } from 'bun:test'
import { Config, Effect } from 'effect'
import { runCli } from '../_support/cli.ts'
import { startFixture } from '../_support/fixture.ts'
import { eff } from '../_support/run.ts'
import { body, json } from '../lib/sources/support.ts'

const crawl = eff(
  Effect.gen(function* () {
    const recorded = yield* body('wayback-cdx.json')
    const fx = yield* startFixture((origin) => ({
      '/collinfo.json': () => new Response('down', { status: 503 }),
      '/cdx/search/cdx': () =>
        json(
          recorded
            .replace('http://example.com:80/', `${origin}/site/docs`)
            .replace('http://www.example.com:80/', `${origin}/site/blog`),
        ),
    }))
    const PATH = yield* Config.String('PATH').pipe(Config.orElse(() => Config.String('Path')))
    const HOME = yield* Config.String('HOME').pipe(Config.withDefault('/tmp'))
    const env = { PATH, HOME, WEBULAR_SOURCE_ORIGIN: fx.origin, WEBULAR_SOURCE_GAP_MS: '0' }
    const run = yield* runCli('src/commands/crawl.ts', ['--url', `${fx.origin}/site/`, '--json'], {
      env,
    })
    expect(run.code).toBe(0)
    const urls = JSON.parse(run.out).pages.map((p: { url: string }) => p.url)
    expect(urls.sort()).toEqual([`${fx.origin}/site/blog`, `${fx.origin}/site/docs`])
  }),
)

describe('webular crawl — Wayback CDX behind Common Crawl', () => {
  test('a dead root falls back to Wayback when Common Crawl fails', crawl, 45_000)
})
