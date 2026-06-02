// DOCTOR contract — real local toolchain checks (no mocks, no fixtures to clean up).
import { describe, expect, test } from 'bun:test'

const ROOT = new URL('../../', import.meta.url).pathname

async function runDoctor(args: string[]): Promise<{ code: number; out: string; err: string }> {
  const proc = Bun.spawn(['bun', `${ROOT}src/commands/doctor.ts`, ...args], {
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const out = await new Response(proc.stdout).text()
  const err = await new Response(proc.stderr).text()
  const code = await proc.exited
  return { code, out, err }
}

describe('webular doctor — environment diagnostics (real checks)', () => {
  test('doctor --json exits 0 and has a bun check with ok true', async () => {
    const { code, out } = await runDoctor(['--json'])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(typeof data.ok).toBe('boolean')
    expect(Array.isArray(data.checks)).toBe(true)
    const bunCheck = data.checks.find((c: { name: string }) => c.name === 'bun')
    expect(bunCheck).toBeDefined()
    expect(bunCheck.ok).toBe(true)
  }, 30_000)

  test('doctor --json result includes a mise check', async () => {
    const { code, out } = await runDoctor(['--json'])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    const miseCheck = data.checks.find((c: { name: string }) => c.name === 'mise')
    expect(miseCheck).toBeDefined()
  }, 30_000)
})
