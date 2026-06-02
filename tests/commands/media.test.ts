// MEDIA contract — real download from a stable live URL (no mocks).
// Tests user-facing behavior of `media --url ... --download -o <tmp> --json`.
import { describe, expect, test } from 'bun:test'
import { existsSync, statSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = new URL('../../', import.meta.url).pathname

async function runMedia(args: string[]): Promise<{ code: number; out: string; err: string }> {
  const proc = Bun.spawn(['bun', `${ROOT}src/commands/media.ts`, ...args], {
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const out = await new Response(proc.stdout).text()
  const err = await new Response(proc.stderr).text()
  const code = await proc.exited
  return { code, out, err }
}

describe('webular media — download bytes from a real URL', () => {
  test('downloads a file and reports savedTo + bytes with --json', async () => {
    const dest = join(tmpdir(), `webular-media-test-${Date.now()}.html`)
    const { code, out } = await runMedia([
      '--url',
      'https://example.com',
      '--download',
      '-o',
      dest,
      '--json',
    ])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(data.savedTo).toBe(dest)
    expect(data.bytes).toBeGreaterThan(0)
    expect(existsSync(dest)).toBe(true)
    expect(statSync(dest).size).toBeGreaterThan(0)
    unlinkSync(dest)
  }, 30_000)

  test('exits with code 2 when --url is missing', async () => {
    const { code, err } = await runMedia(['--download'])
    expect(code).toBe(2)
    expect(err).toContain('missing')
  })

  test('writes to a temp file when -o is omitted', async () => {
    const { code, out } = await runMedia(['--url', 'https://example.com', '--download', '--json'])
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(typeof data.savedTo).toBe('string')
    expect(data.bytes).toBeGreaterThan(0)
    if (existsSync(data.savedTo)) unlinkSync(data.savedTo)
  }, 30_000)
})
