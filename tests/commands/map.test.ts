// MAP contract — real fetch of a stable live page (no mocks). Tests the
// user-facing command behavior that `mise run run:map` executes.
import { describe, expect, test } from 'bun:test'

const ROOT = new URL('../../', import.meta.url).pathname

async function runMap(args: string[]): Promise<{ code: number; out: string; err: string }> {
  const proc = Bun.spawn(['bun', `${ROOT}src/commands/map.ts`, ...args], {
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const out = await new Response(proc.stdout).text()
  const err = await new Response(proc.stderr).text()
  const code = await proc.exited
  return { code, out, err }
}

describe('webular map — discover all URLs for a domain (real fetch)', () => {
  test('emits JSON with non-empty links array and iana.org link', async () => {
    const { code, out } = await runMap(['--url', 'https://example.com', '--json'])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(Array.isArray(data.links)).toBe(true)
    expect(data.links.length).toBeGreaterThan(0)
    const hasIana = data.links.some((l: string) => l.includes('iana.org'))
    expect(hasIana).toBe(true)
  }, 30_000)

  test('count equals links.length', async () => {
    const { code, out } = await runMap(['--url', 'https://example.com', '--json'])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(data.count).toBe(data.links.length)
  }, 30_000)

  test('exits with code 2 when url is missing', async () => {
    const { code, err } = await runMap([])
    expect(code).toBe(2)
    expect(err).toContain('missing')
  })
})
