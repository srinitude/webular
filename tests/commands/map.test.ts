// MAP contract — URL discovery against the deterministic local fixture (no mocks).
// Tests the user-facing command behavior that `mise run run:map` executes.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { runCli } from '../_support/cli.ts'
import { useFixture } from '../_support/fixture.ts'
import { defaultRoutes } from '../_support/routes.ts'
import { eff } from '../_support/run.ts'

const fx = useFixture(defaultRoutes)

const runMap = (args: string[]) => runCli('src/commands/map.ts', args)

describe('webular map — discover all URLs for a domain (real fetch)', () => {
  test(
    'emits JSON with links discovered from the sitemap',
    eff(
      Effect.gen(function* () {
        const { code, out } = yield* runMap(['--url', fx.origin, '--json'])
        expect(code).toBe(0)
        const data = JSON.parse(out)
        expect(Array.isArray(data.links)).toBe(true)
        expect(data.links.length).toBeGreaterThan(0)
        expect(data.links).toContain(`${fx.origin}/a`)
      }),
    ),
    15_000,
  )

  test(
    'merges sitemap URLs with same-host page links, sitemap order first',
    eff(
      Effect.gen(function* () {
        const { code, out } = yield* runMap(['--url', `${fx.origin}/`, '--json'])
        expect(code).toBe(0)
        const { links } = JSON.parse(out)
        expect(links).toEqual([`${fx.origin}/a`, `${fx.origin}/b`, `${fx.origin}/c`])
      }),
    ),
    15_000,
  )

  test(
    'count equals links.length',
    eff(
      Effect.gen(function* () {
        const { code, out } = yield* runMap(['--url', fx.origin, '--json'])
        expect(code).toBe(0)
        const data = JSON.parse(out)
        expect(data.count).toBe(data.links.length)
      }),
    ),
    15_000,
  )

  test(
    'exits with code 2 when url is missing',
    eff(
      Effect.gen(function* () {
        const { code, err } = yield* runMap([])
        expect(code).toBe(2)
        expect(err).toContain('missing')
      }),
    ),
  )

  test(
    'exits with code 2 for a non-integer --limit',
    eff(
      Effect.gen(function* () {
        const { code, err } = yield* runMap(['--url', fx.origin, '--limit', 'abc'])
        expect(code).toBe(2)
        expect(err).toContain('--limit')
      }),
    ),
  )
})
