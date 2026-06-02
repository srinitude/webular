// DIAGRAM contract — lists .mmd files without rendering (no mmdc needed).
import { describe, expect, test } from 'bun:test'

const ROOT = new URL('../../', import.meta.url).pathname

async function runDiagram(args: string[]): Promise<{ code: number; out: string; err: string }> {
  const proc = Bun.spawn(['bun', `${ROOT}src/commands/diagram.ts`, ...args], {
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const out = await new Response(proc.stdout).text()
  const err = await new Response(proc.stderr).text()
  const code = await proc.exited
  return { code, out, err }
}

describe('webular diagram — list .mmd files', () => {
  test('diagram --list --json exits 0 and returns diagram list', async () => {
    const { code, out } = await runDiagram(['--list', '--json'])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(typeof data.count).toBe('number')
    expect(data.count).toBeGreaterThanOrEqual(7)
    expect(Array.isArray(data.diagrams)).toBe(true)
    expect(data.diagrams).toContain('01-sequence')
  }, 15_000)
})
