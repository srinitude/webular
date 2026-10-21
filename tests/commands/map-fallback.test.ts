// MAP free-source fallback (2603.01548), against a real local Bun.serve
// fixture. The site path 404s, so map's own fetch fails and it asks the
// archive indexes, which answer with the site's archived URLs. No mocks.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { archived } from '../_support/archive-fixture.ts'
import { runCli } from '../_support/cli.ts'
import { eff } from '../_support/run.ts'

const map = eff(
  Effect.gen(function* () {
    const { site, urls, env } = yield* archived
    const run = yield* runCli('src/commands/map.ts', ['--url', site, '--json'], { env })
    expect(run.code).toBe(0)
    const result = JSON.parse(run.out)
    expect(result.links).toEqual(urls)
  }),
)

describe('webular map — free-source fallback', () => {
  test('a failing site fetch falls back to the archive indexes', map, 45_000)
})
