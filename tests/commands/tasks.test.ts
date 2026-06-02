// TASKS contract — real mise invocation from repo root (no mocks).
import { describe, expect, test } from 'bun:test'

const ROOT = new URL('../../', import.meta.url).pathname

async function runTasks(args: string[]): Promise<{ code: number; out: string; err: string }> {
  const proc = Bun.spawn(['bun', `${ROOT}src/commands/tasks.ts`, ...args], {
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const out = await new Response(proc.stdout).text()
  const err = await new Response(proc.stderr).text()
  const code = await proc.exited
  return { code, out, err }
}

describe('webular tasks — introspect the mise task graph (real mise)', () => {
  test('emits structured JSON with --json and includes expected tasks', async () => {
    const { code, out } = await runTasks(['--json'])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(typeof data.count).toBe('number')
    expect(data.count).toBeGreaterThan(0)
    expect(Array.isArray(data.tasks)).toBe(true)
    expect(data.tasks).toContain('run:scrape')
    expect(data.tasks).toContain('ci')
  }, 30_000)

  test('prints task list in plain text without --json', async () => {
    const { code, out } = await runTasks([])
    expect(code).toBe(0)
    expect(out).toContain('run:scrape')
    expect(out).toContain('ci')
  }, 30_000)
})
