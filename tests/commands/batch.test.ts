// BATCH contract — real fetch of stable live pages (no mocks). Tests the
// user-facing command behavior that `mise run run:batch` executes.
import { describe, expect, test } from 'bun:test'
import { unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = new URL('../../', import.meta.url).pathname

async function runBatch(args: string[]): Promise<{ code: number; out: string; err: string }> {
  const proc = Bun.spawn(['bun', `${ROOT}src/commands/batch.ts`, ...args], {
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const out = await new Response(proc.stdout).text()
  const err = await new Response(proc.stderr).text()
  const code = await proc.exited
  return { code, out, err }
}

describe('webular batch — concurrent scrape of multiple URLs (real fetch)', () => {
  test('scrapes two live pages and returns count === 2 with --json', async () => {
    const { code, out } = await runBatch([
      '--op',
      'scrape',
      '--urls',
      'https://example.com,https://www.iana.org',
      '--json',
    ])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(data.op).toBe('scrape')
    expect(data.count).toBe(2)
    expect(data.results.length).toBe(2)
    const exampleResult = data.results.find((r: { url: string }) => r.url === 'https://example.com')
    expect(exampleResult).toBeDefined()
    expect(exampleResult.ok).toBe(true)
    expect(data.results.every((r: { url: string }) => typeof r.url === 'string')).toBe(true)
  }, 45_000)

  test('reads URLs from a file with --input', async () => {
    const tmpFile = join(tmpdir(), 'webular-batch-test-urls.txt')
    writeFileSync(tmpFile, 'https://example.com\n')
    try {
      const { code, out } = await runBatch(['--input', tmpFile, '--json'])
      expect(code).toBe(0)
      const data = JSON.parse(out)
      expect(data.count).toBe(1)
      expect(data.results[0].url).toBe('https://example.com')
      expect(data.results[0].ok).toBe(true)
    } finally {
      unlinkSync(tmpFile)
    }
  }, 30_000)

  test('exits with code 2 when URLs are missing', async () => {
    const { code, err } = await runBatch([])
    expect(code).toBe(2)
    expect(err).toContain('missing')
  })

  test('exits with code 2 for an unknown --op', async () => {
    const { code, err } = await runBatch(['--op', 'unknown', '--urls', 'https://example.com'])
    expect(code).toBe(2)
    expect(err).toContain('unknown op')
  })
})
