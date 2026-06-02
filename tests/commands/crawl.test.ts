// CRAWL contract — real BFS crawl of a stable live page (no mocks).
import { describe, expect, test } from 'bun:test'

const ROOT = new URL('../../', import.meta.url).pathname

async function runCrawl(args: string[]): Promise<{ code: number; out: string; err: string }> {
  const proc = Bun.spawn(['bun', `${ROOT}src/commands/crawl.ts`, ...args], {
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const out = await new Response(proc.stdout).text()
  const err = await new Response(proc.stderr).text()
  const code = await proc.exited
  return { code, out, err }
}

describe('webular crawl — recursive BFS crawl (real fetch)', () => {
  test('crawls 1 page from example.com with --json', async () => {
    const { code, out } = await runCrawl(['--url', 'https://example.com', '--limit', '1', '--json'])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(data.count).toBe(1)
    expect(data.pages[0].url).toContain('example.com')
  }, 30_000)

  test('exits with code 2 when URL is missing', async () => {
    const { code, err } = await runCrawl([])
    expect(code).toBe(2)
    expect(err).toContain('missing')
  })
})
