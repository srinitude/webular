// ACT contract — real browser automation via agent-browser (no mocks).
// The live snapshot test runs only when the agent-browser binary is present.
import { describe, expect, test } from 'bun:test'
import { available } from '../../src/lib/agentbrowser.ts'

const ROOT = new URL('../../', import.meta.url).pathname

async function runAct(args: string[]): Promise<{ code: number; out: string; err: string }> {
  const proc = Bun.spawn(['bun', `${ROOT}src/commands/act.ts`, ...args], {
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const out = await new Response(proc.stdout).text()
  const err = await new Response(proc.stderr).text()
  const code = await proc.exited
  return { code, out, err }
}

describe('webular act — real browser automation via agent-browser', () => {
  test.skipIf(!available())(
    'snapshots a live page accessibility tree',
    async () => {
      const { code, out } = await runAct(['--url', 'https://example.com', '--json'])
      expect(code).toBe(0)
      expect(out).toContain('Example Domain')
    },
    60_000,
  )

  test('exits with code 2 when the URL is missing', async () => {
    const { code, err } = await runAct([])
    expect(code).toBe(2)
    expect(err).toContain('missing')
  })
})
