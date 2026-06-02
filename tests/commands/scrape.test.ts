// SCRAPE contract — real fetch of a stable live page (no mocks). Tests the
// user-facing command behavior that `mise run run:scrape` executes.
import { describe, expect, test } from 'bun:test'

const ROOT = new URL('../../', import.meta.url).pathname

async function runScrape(args: string[]): Promise<{ code: number; out: string; err: string }> {
  const proc = Bun.spawn(['bun', `${ROOT}src/commands/scrape.ts`, ...args], {
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const out = await new Response(proc.stdout).text()
  const err = await new Response(proc.stderr).text()
  const code = await proc.exited
  return { code, out, err }
}

describe('webular scrape — single URL to clean content (real fetch)', () => {
  test('returns markdown for a live page', async () => {
    const { code, out } = await runScrape(['--url', 'https://example.com'])
    expect(code).toBe(0)
    expect(out).toContain('Example Domain')
  }, 30_000)

  test('emits structured JSON with --json', async () => {
    const { code, out } = await runScrape(['--url', 'https://example.com', '--json'])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(data.url).toBe('https://example.com')
    expect(typeof data.markdown).toBe('string')
    expect(data.title.length).toBeGreaterThan(0)
  }, 30_000)

  test('exits with code 2 when the URL is missing', async () => {
    const { code, err } = await runScrape([])
    expect(code).toBe(2)
    expect(err).toContain('missing')
  })
})
