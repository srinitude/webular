// EXTRACT contract — real fetch of a stable live page (no mocks). Tests the
// user-facing command behavior that `mise run run:extract` executes.
import { describe, expect, test } from 'bun:test'

const ROOT = new URL('../../', import.meta.url).pathname

async function runExtract(args: string[]): Promise<{ code: number; out: string; err: string }> {
  const proc = Bun.spawn(['bun', `${ROOT}src/commands/extract.ts`, ...args], {
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const out = await new Response(proc.stdout).text()
  const err = await new Response(proc.stderr).text()
  const code = await proc.exited
  return { code, out, err }
}

describe('webular extract — CSS-selector structured extraction (real fetch)', () => {
  test('extracts a named field from a live page with --fields', async () => {
    const { code, out } = await runExtract([
      '--url',
      'https://example.com',
      '--fields',
      'title:h1',
      '--json',
    ])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(data.url).toBe('https://example.com')
    expect(data.data.title).toBe('Example Domain')
  }, 30_000)

  test('extracts multiple named fields with comma-separated --fields', async () => {
    const { code, out } = await runExtract([
      '--url',
      'https://example.com',
      '--fields',
      'title:h1,para:p',
      '--json',
    ])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(data.data.title).toBe('Example Domain')
    expect(typeof data.data.para).toBe('string')
    expect(data.data.para.length).toBeGreaterThan(0)
  }, 30_000)

  test('extracts matches array with --selector', async () => {
    const { code, out } = await runExtract([
      '--url',
      'https://example.com',
      '--selector',
      'h1',
      '--json',
    ])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(Array.isArray(data.matches)).toBe(true)
    expect(data.matches[0]).toBe('Example Domain')
  }, 30_000)

  test('exits with code 2 when the URL is missing', async () => {
    const { code, err } = await runExtract(['--fields', 'title:h1'])
    expect(code).toBe(2)
    expect(err).toContain('missing')
  })

  test('exits with code 2 when neither --fields nor --selector is provided', async () => {
    const { code, err } = await runExtract(['--url', 'https://example.com'])
    expect(code).toBe(2)
    expect(err).toContain('--fields')
  })
})
