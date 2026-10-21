// EXTRACT contract — CSS-selector extraction against the local fixture (no mocks).
// Tests the user-facing command behavior that `mise run run:extract` executes.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { runCli } from '../_support/cli.ts'
import { useFixture } from '../_support/fixture.ts'
import { defaultRoutes } from '../_support/routes.ts'
import { eff } from '../_support/run.ts'

const fx = useFixture(defaultRoutes)

const runExtract = (args: string[]) => runCli('src/commands/extract.ts', args)

describe('webular extract — CSS-selector structured extraction (real fetch)', () => {
  test(
    'extracts a named field from a fixture page with --fields',
    eff(
      Effect.gen(function* () {
        const { code, out } = yield* runExtract([
          '--url',
          `${fx.origin}/`,
          '--fields',
          'title:h1',
          '--json',
        ])
        expect(code).toBe(0)
        const data = JSON.parse(out)
        expect(data.url).toBe(`${fx.origin}/`)
        expect(data.data.title).toBe('Fixture Home')
      }),
    ),
    15_000,
  )

  test(
    'extracts multiple named fields with comma-separated --fields',
    eff(
      Effect.gen(function* () {
        const { code, out } = yield* runExtract([
          '--url',
          `${fx.origin}/`,
          '--fields',
          'title:h1,para:p',
          '--json',
        ])
        expect(code).toBe(0)
        const data = JSON.parse(out)
        expect(data.data.title).toBe('Fixture Home')
        expect(typeof data.data.para).toBe('string')
        expect(data.data.para.length).toBeGreaterThan(0)
      }),
    ),
    15_000,
  )

  test(
    'extracts matches array with --selector',
    eff(
      Effect.gen(function* () {
        const { code, out } = yield* runExtract([
          '--url',
          `${fx.origin}/`,
          '--selector',
          'h1',
          '--json',
        ])
        expect(code).toBe(0)
        const data = JSON.parse(out)
        expect(Array.isArray(data.matches)).toBe(true)
        expect(data.matches[0]).toBe('Fixture Home')
      }),
    ),
    15_000,
  )

  test(
    'exits with code 2 when the URL is missing',
    eff(
      Effect.gen(function* () {
        const { code, err } = yield* runExtract(['--fields', 'title:h1'])
        expect(code).toBe(2)
        expect(err).toContain('missing')
      }),
    ),
  )

  test(
    'exits with code 2 when neither --fields nor --selector is provided',
    eff(
      Effect.gen(function* () {
        const { code, err } = yield* runExtract(['--url', `${fx.origin}/`])
        expect(code).toBe(2)
        expect(err).toContain('--fields')
      }),
    ),
  )
})
