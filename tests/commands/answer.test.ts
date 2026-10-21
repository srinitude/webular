// ANSWER contract — real search + fetch + summarize (no mocks). Tests the
// user-facing command behavior that `mise run run:answer` executes.
import { describe, expect, test } from 'bun:test'

import { Effect } from 'effect'
import { runCli } from '../_support/cli.ts'
import { useFixture } from '../_support/fixture.ts'
import { defaultRoutes } from '../_support/routes.ts'
import { eff } from '../_support/run.ts'

const fx = useFixture(defaultRoutes)

// Live DDG search is blocked from datacenter IPs and inherently varies run to
// run; opt in with WEBULAR_TEST_LIVE=1. The missing-arg contract always runs.
const SKIP_LIVE = !process.env['WEBULAR_TEST_LIVE']

const runAnswer = (args: string[]) => runCli('src/commands/answer.ts', args)

describe('webular answer — grounded answer from real search + fetch', () => {
  test.skipIf(SKIP_LIVE)(
    'returns JSON with answer and sources for a real query',
    eff(
      Effect.gen(function* () {
        const { code, out } = yield* runAnswer([
          '--query',
          'what is the bun javascript runtime',
          '--json',
        ])
        expect(code).toBe(0)
        const data = JSON.parse(out)
        expect(typeof data.answer).toBe('string')
        expect(data.answer.length).toBeGreaterThan(0)
        expect(Array.isArray(data.sources)).toBe(true)
        expect(data.sources.length).toBeGreaterThan(0)
        expect(typeof data.sources[0].url).toBe('string')
        expect(data.sources[0].url.length).toBeGreaterThan(0)
      }),
    ),
    45_000,
  )

  test(
    'exits with code 2 when query is missing',
    eff(
      Effect.gen(function* () {
        const { code, err } = yield* runAnswer([])
        expect(code).toBe(2)
        expect(err).toContain('missing')
      }),
    ),
  )

  test(
    'exits with code 2 for a non-integer --sources',
    eff(
      Effect.gen(function* () {
        const { code, err } = yield* runAnswer(['--query', 'x', '--sources', 'abc'])
        expect(code).toBe(2)
        expect(err).toContain('--sources')
      }),
    ),
  )

  test(
    'with --urls reads only the given pages and cites them',
    eff(
      Effect.gen(function* () {
        const url = `${fx.origin}/a`
        const { code, out } = yield* runAnswer(['--query', 'anything', '--urls', url, '--json'])
        expect(code).toBe(0)
        const data = JSON.parse(out)
        expect(data.sources.map((s: { url: string }) => s.url)).toEqual([url])
        expect(data.answer.length).toBeGreaterThan(0)
      }),
    ),
    20_000,
  )
})
