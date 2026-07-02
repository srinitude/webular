// SEARCH contract — real DDG search (no mocks). Tests the user-facing command
// behavior that `mise run run:search` executes.
import { describe, expect, test } from 'bun:test'

import { runCli } from '../_support/cli.ts'
import { ROOT } from '../_support/root.ts'

// Live DDG search is blocked from datacenter IPs and inherently varies run to
// run; opt in with WEBULAR_TEST_LIVE=1. The missing-arg contract always runs.
const SKIP_LIVE = !process.env.WEBULAR_TEST_LIVE

const runSearch = (args: string[]) => runCli('src/commands/search.ts', args)

describe('webular search — keyless web search (real network)', () => {
  test.skipIf(SKIP_LIVE)(
    'returns JSON results for a real query',
    async () => {
      const { code, out } = await runSearch(['--query', 'bun javascript runtime', '--json'])
      expect(code).toBe(0)
      const data = JSON.parse(out)
      expect(data.query).toBe('bun javascript runtime')
      expect(Array.isArray(data.results)).toBe(true)
      expect(data.results.length).toBeGreaterThan(0)
      expect(data.results[0].url).toMatch(/^https?:\/\//)
    },
    30_000,
  )

  test.skipIf(SKIP_LIVE)(
    'accepts positional query argument',
    async () => {
      const { code, out } = await runSearch(['bun javascript runtime', '--json'])
      expect(code).toBe(0)
      const data = JSON.parse(out)
      expect(Array.isArray(data.results)).toBe(true)
    },
    30_000,
  )

  test.skipIf(SKIP_LIVE)(
    'respects --limit flag',
    async () => {
      const { code, out } = await runSearch([
        '--query',
        'bun javascript runtime',
        '--limit',
        '3',
        '--json',
      ])
      expect(code).toBe(0)
      const data = JSON.parse(out)
      expect(data.results.length).toBeLessThanOrEqual(3)
    },
    30_000,
  )

  test('exits with code 2 when query is missing', async () => {
    const { code, err } = await runSearch([])
    expect(code).toBe(2)
    expect(err).toContain('missing')
  })

  test('exits with code 2 for a non-integer --limit', async () => {
    const { code, err } = await runSearch(['--query', 'x', '--limit', 'abc'])
    expect(code).toBe(2)
    expect(err).toContain('--limit')
  })

  test("legacy --format's value is consumed (never swallowed as the query) and warned", async () => {
    const { code, err } = await runSearch(['--format', 'json'])
    expect(code).toBe(2)
    expect(err).toContain('missing')
    expect(err).toContain('--format')
    expect(err).toContain('removed')
  })

  test('legacy --quiet warns and is otherwise inert', async () => {
    const { code, err } = await runSearch(['--quiet'])
    expect(code).toBe(2)
    expect(err).toContain('--quiet')
    expect(err).toContain('removed')
  })
})
