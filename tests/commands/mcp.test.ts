// MCP command test — fast, no server start needed.
// Verifies that `mcp --list --json` returns code 0 and includes "web.fetch".
import { describe, expect, test } from 'bun:test'

const ROOT = new URL('../../', import.meta.url).pathname

async function runMcp(args: string[]): Promise<{ code: number; out: string; err: string }> {
  const proc = Bun.spawn(['bun', `${ROOT}src/commands/mcp.ts`, ...args], {
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const out = await new Response(proc.stdout).text()
  const err = await new Response(proc.stderr).text()
  const code = await proc.exited
  return { code, out, err }
}

describe('webular mcp — MCP server tool listing', () => {
  test('--list --json exits 0 and includes web.fetch', async () => {
    const { code, out } = await runMcp(['--list', '--json'])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(typeof data.count).toBe('number')
    expect(data.count).toBeGreaterThan(0)
    expect(Array.isArray(data.tools)).toBe(true)
    expect(data.tools).toContain('web.fetch')
  }, 15_000)

  test('--list exits 0 and outputs tool count and names', async () => {
    const { code, out } = await runMcp(['--list'])
    expect(code).toBe(0)
    expect(out).toContain('web.fetch')
  }, 15_000)
})
