// Scrape determinism (A1): identical input ⇒ byte-identical --json output,
// with no wall-clock field in the schema. Runs the real command process.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { runCli } from '../_support/cli.ts'
import { useFixture } from '../_support/fixture.ts'
import { defaultRoutes } from '../_support/routes.ts'
import { eff } from '../_support/run.ts'

const fx = useFixture(defaultRoutes)

const scrapeJson = (url: string) =>
  Effect.gen(function* () {
    const { code, out } = yield* runCli('src/commands/scrape.ts', ['--url', url, '--json'])
    expect(code).toBe(0)
    return out
  })

describe('scrape — deterministic output (A1)', () => {
  test(
    'carries no wall-clock field',
    eff(
      Effect.gen(function* () {
        const data = JSON.parse(yield* scrapeJson(`${fx.origin}/`))
        expect('fetchedAt' in data).toBe(false)
      }),
    ),
    15_000,
  )

  test(
    'two identical runs produce byte-identical JSON',
    eff(
      Effect.gen(function* () {
        const first = yield* scrapeJson(`${fx.origin}/a`)
        const second = yield* scrapeJson(`${fx.origin}/a`)
        expect(first).toBe(second)
      }),
    ),
    30_000,
  )
})
