// MAP contract — URL discovery against the deterministic local fixture (no mocks).
// Tests the user-facing command behavior that `mise run run:map` executes.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { runCli } from '../_support/cli.ts'
import { type Fixture, startFixture } from '../_support/fixture.ts'
import { ROOT } from '../_support/root.ts'
import { defaultRoutes } from '../_support/routes.ts'

let fx: Fixture
beforeAll(() => {
  fx = startFixture(defaultRoutes)
})
afterAll(() => fx.stop())

const runMap = (args: string[]) => runCli('src/commands/map.ts', args)

describe('webular map — discover all URLs for a domain (real fetch)', () => {
  test('emits JSON with links discovered from the sitemap', async () => {
    const { code, out } = await runMap(['--url', fx.origin, '--json'])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(Array.isArray(data.links)).toBe(true)
    expect(data.links.length).toBeGreaterThan(0)
    expect(data.links).toContain(`${fx.origin}/a`)
  }, 15_000)

  test('count equals links.length', async () => {
    const { code, out } = await runMap(['--url', fx.origin, '--json'])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(data.count).toBe(data.links.length)
  }, 15_000)

  test('exits with code 2 when url is missing', async () => {
    const { code, err } = await runMap([])
    expect(code).toBe(2)
    expect(err).toContain('missing')
  })

  test('exits with code 2 for a non-integer --limit', async () => {
    const { code, err } = await runMap(['--url', fx.origin, '--limit', 'abc'])
    expect(code).toBe(2)
    expect(err).toContain('--limit')
  })
})
