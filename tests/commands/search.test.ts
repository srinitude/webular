// SEARCH contract — real DDG search (no mocks). Tests the user-facing command
// behavior that `mise run run:search` executes.
import { describe, expect, test } from 'bun:test'

const ROOT = new URL('../../', import.meta.url).pathname
// Live DDG search is blocked from CI datacenter IPs; live tests run locally
// (real, no mocks) and skip in CI. The missing-arg contract still runs in CI.
const SKIP_LIVE = !!process.env.CI

async function runSearch(args: string[]): Promise<{ code: number; out: string; err: string }> {
  const proc = Bun.spawn(['bun', `${ROOT}src/commands/search.ts`, ...args], {
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const out = await new Response(proc.stdout).text()
  const err = await new Response(proc.stderr).text()
  const code = await proc.exited
  return { code, out, err }
}

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
})
