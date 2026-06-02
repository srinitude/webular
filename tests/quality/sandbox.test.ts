// Bucket A contract: WEBULAR_SANDBOX=1 confines output paths (opt-in). Real
// command runs (example.com); default behavior is covered by the command tests.
import { afterAll, describe, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'

const ROOT = new URL('../../', import.meta.url).pathname
const OUT = '.tmp-sandbox-out.md'

async function scrape(args: string[]): Promise<{ code: number; err: string }> {
  const proc = Bun.spawn(
    ['bun', `${ROOT}src/commands/scrape.ts`, '--url', 'https://example.com', ...args],
    {
      cwd: ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env, WEBULAR_SANDBOX: '1' },
    },
  )
  const err = await new Response(proc.stderr).text()
  const code = await proc.exited
  return { code, err }
}

describe('WEBULAR_SANDBOX confines output paths (opt-in hardening)', () => {
  afterAll(async () => {
    await rm(`${ROOT}${OUT}`, { force: true })
  })

  test('rejects an absolute -o path', async () => {
    const { code, err } = await scrape(['-o', '/tmp/webular-evil.md'])
    expect(code).not.toBe(0)
    expect(err.toLowerCase()).toContain('sandbox')
  }, 30_000)

  test('rejects a parent-directory -o path', async () => {
    const { code, err } = await scrape(['-o', '../escape.md'])
    expect(code).not.toBe(0)
    expect(err.toLowerCase()).toContain('sandbox')
  }, 30_000)

  test('allows a contained relative -o path', async () => {
    const { code } = await scrape(['-o', OUT])
    expect(code).toBe(0)
  }, 30_000)
})
