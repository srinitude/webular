// SCRAPE contract — real fetch against the deterministic local fixture (no mocks).
// Tests the user-facing command behavior that `mise run run:scrape` executes.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { runCli } from '../_support/cli.ts'
import { useFixture } from '../_support/fixture.ts'
import { defaultRoutes } from '../_support/routes.ts'
import { eff } from '../_support/run.ts'

const fx = useFixture(defaultRoutes)

const runScrape = (args: string[]) => runCli('src/commands/scrape.ts', args)

describe('webular scrape — single URL to clean content (real fetch)', () => {
  test(
    'returns markdown for a fixture page',
    eff(
      Effect.gen(function* () {
        const { code, out } = yield* runScrape(['--url', `${fx.origin}/`])
        expect(code).toBe(0)
        expect(out).toContain('Fixture Home')
      }),
    ),
    15_000,
  )

  test(
    'emits structured JSON with --json',
    eff(
      Effect.gen(function* () {
        const { code, out } = yield* runScrape(['--url', `${fx.origin}/`, '--json'])
        expect(code).toBe(0)
        const data = JSON.parse(out)
        expect(data.url).toBe(`${fx.origin}/`)
        expect(typeof data.markdown).toBe('string')
        expect(data.title.length).toBeGreaterThan(0)
      }),
    ),
    15_000,
  )

  test(
    'exits with code 2 when the URL is missing',
    eff(
      Effect.gen(function* () {
        const { code, err } = yield* runScrape([])
        expect(code).toBe(2)
        expect(err).toContain('missing')
      }),
    ),
  )

  test(
    "legacy --format's value never becomes the URL",
    eff(
      Effect.gen(function* () {
        const { code, err } = yield* runScrape(['--format', 'md'])
        expect(code).toBe(2)
        expect(err).toContain('missing')
      }),
    ),
  )
})
