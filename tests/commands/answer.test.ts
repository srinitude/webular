// ANSWER contract — real search + fetch + summarize (no mocks). Tests the
// user-facing command behavior that `mise run run:answer` executes.
import { describe, expect, test } from 'bun:test'

const ROOT = new URL('../../', import.meta.url).pathname

async function runAnswer(args: string[]): Promise<{ code: number; out: string; err: string }> {
  const proc = Bun.spawn(['bun', `${ROOT}src/commands/answer.ts`, ...args], {
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const out = await new Response(proc.stdout).text()
  const err = await new Response(proc.stderr).text()
  const code = await proc.exited
  return { code, out, err }
}

describe('webular answer — grounded answer from real search + fetch', () => {
  test('returns JSON with answer and sources for a real query', async () => {
    const { code, out } = await runAnswer([
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
  }, 45_000)

  test('exits with code 2 when query is missing', async () => {
    const { code, err } = await runAnswer([])
    expect(code).toBe(2)
    expect(err).toContain('missing')
  })
})
