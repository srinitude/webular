// RESEARCH contract — real DDG search + fetch (no mocks). Tests the user-facing
// command behavior that `mise run run:research` executes.
import { describe, expect, test } from 'bun:test'

const ROOT = new URL('../../', import.meta.url).pathname

async function runResearch(args: string[]): Promise<{ code: number; out: string; err: string }> {
  const proc = Bun.spawn(['bun', `${ROOT}src/commands/research.ts`, ...args], {
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const out = await new Response(proc.stdout).text()
  const err = await new Response(proc.stderr).text()
  const code = await proc.exited
  return { code, out, err }
}

describe('webular research — multi-step research loop (real network)', () => {
  test('returns JSON report for a real topic with --depth 2', async () => {
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
  }, 60_000)

  test('exits with code 2 when topic is missing', async () => {
    const { code, err } = await runResearch([])
    expect(code).toBe(2)
    expect(err).toContain('missing')
  })
})
