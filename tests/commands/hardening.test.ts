// Bucket B contract: resource-limit guards (batch URL ceiling, download cap).
import { describe, expect, test } from 'bun:test'

const ROOT = new URL('../../', import.meta.url).pathname

async function run(file: string, args: string[]): Promise<{ code: number; err: string }> {
  const proc = Bun.spawn(['bun', `${ROOT}src/commands/${file}`, ...args], {
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const err = await new Response(proc.stderr).text()
  const code = await proc.exited
  return { code, err }
}

describe('resource-limit hardening', () => {
  test('batch rejects more than 1000 URLs', async () => {
    const urls = Array.from({ length: 1001 }, (_, i) => `https://example.com/${i}`).join(',')
    const { code, err } = await run('batch.ts', ['--urls', urls, '--json'])
    expect(code).toBe(2)
    expect(err.toLowerCase()).toContain('too many')
  })

  test('media download enforces --max-bytes', async () => {
    const args = [
      '--url',
      'https://example.com',
      '--download',
      '--max-bytes',
      '5',
      '-o',
      '/tmp/webular-cap.bin',
    ]
    const { code, err } = await run('media.ts', args)
    expect(code).not.toBe(0)
    expect(err.toLowerCase()).toMatch(/max|exceed/)
  }, 30_000)
})
