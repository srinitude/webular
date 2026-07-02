// RESEARCH contract — real DDG search + fetch (no mocks). Tests the user-facing
// command behavior that `mise run run:research` executes.
import { describe, expect, test } from 'bun:test'

import { runCli } from '../_support/cli.ts'
import { ROOT } from '../_support/root.ts'

// Live DDG search is blocked from datacenter IPs and inherently varies run to
// run; opt in with WEBULAR_TEST_LIVE=1. The missing-arg contract always runs.
const SKIP_LIVE = !process.env.WEBULAR_TEST_LIVE

const runResearch = (args: string[]) => runCli('src/commands/research.ts', args)

describe('webular research — multi-step research loop (real network)', () => {
  test.skipIf(SKIP_LIVE)(
    'returns JSON report for a real topic with --depth 2',
    async () => {
      const { code, out } = await runResearch([
        '--topic',
        'bun javascript runtime',
        '--depth',
        '2',
        '--json',
      ])
      expect(code).toBe(0)
      const data = JSON.parse(out)
      expect(typeof data.topic).toBe('string')
      expect(data.topic).toBe('bun javascript runtime')
      expect(typeof data.report).toBe('string')
      expect(data.report.length).toBeGreaterThan(0)
      expect(Array.isArray(data.sources)).toBe(true)
      expect(data.sources.length).toBeGreaterThanOrEqual(1)
    },
    60_000,
  )

  test('exits with code 2 when topic is missing', async () => {
    const { code, err } = await runResearch([])
    expect(code).toBe(2)
    expect(err).toContain('missing')
  })

  test('exits with code 2 for a non-integer --depth', async () => {
    const { code, err } = await runResearch(['--topic', 'x', '--depth', 'abc'])
    expect(code).toBe(2)
    expect(err).toContain('--depth')
  })
})
