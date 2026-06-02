// AUDIT contract — fast, no network. Tests the user-facing command behavior
// that `mise run run:audit` executes.
import { describe, expect, test } from 'bun:test'

const ROOT = new URL('../../', import.meta.url).pathname

async function runAudit(args: string[]): Promise<{ code: number; out: string; err: string }> {
  const proc = Bun.spawn(['bun', `${ROOT}src/commands/audit.ts`, ...args], {
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const out = await new Response(proc.stdout).text()
  const err = await new Response(proc.stderr).text()
  const code = await proc.exited
  return { code, out, err }
}

describe('webular audit — deepsec scan plan (no real scan)', () => {
  test('--plan --json returns code 0 with valid plan object', async () => {
    const { code, out } = await runAudit(['--plan', '--json'])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(data.tool).toBe('deepsec')
    expect(typeof data.available).toBe('boolean')
    expect(typeof data.command).toBe('string')
    expect(data.command.length).toBeGreaterThan(0)
    expect(data.command).toContain('deepsec')
  }, 30_000)

  test('--json without --plan also returns a valid plan object', async () => {
    const { code, out } = await runAudit(['--json'])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(data.tool).toBe('deepsec')
    expect(data.command).toContain('deepsec')
  }, 30_000)

  test('default output (no --json) prints the command string', async () => {
    const { code, out } = await runAudit(['--plan'])
    expect(code).toBe(0)
    expect(out).toContain('deepsec')
  }, 30_000)
})
