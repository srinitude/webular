// Bucket A contract: WEBULAR_SANDBOX=1 confines output paths (opt-in). Real
// command runs (example.com); default behavior is covered by the command tests.
import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
    await rm(`${ROOT}webular-monitor.db`, { force: true })
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

  test('rejects a path through a symlinked parent directory', async () => {
    const base = await mkdtemp(join(tmpdir(), 'webular-sb-'))
    const target = await mkdtemp(join(tmpdir(), 'webular-tgt-'))
    await symlink(target, join(base, 'link'))
    const proc = Bun.spawn(
      [
        'bun',
        `${ROOT}src/commands/scrape.ts`,
        '--url',
        'https://example.com',
        '-o',
        'link/evil.md',
      ],
      {
        cwd: ROOT,
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...process.env, WEBULAR_SANDBOX: '1', WEBULAR_OUTPUT_DIR: base },
      },
    )
    const err = await new Response(proc.stderr).text()
    const code = await proc.exited
    await rm(base, { recursive: true, force: true })
    await rm(target, { recursive: true, force: true })
    expect(code).not.toBe(0)
    expect(err.toLowerCase()).toContain('sandbox')
  }, 30_000)

  test('sandboxed monitor accepts its default database path', async () => {
    const proc = Bun.spawn(
      ['bun', `${ROOT}src/commands/monitor.ts`, '--url', 'https://example.com', '--json'],
      { cwd: ROOT, stdout: 'pipe', stderr: 'pipe', env: { ...process.env, WEBULAR_SANDBOX: '1' } },
    )
    const out = await new Response(proc.stdout).text()
    const code = await proc.exited
    expect(code).toBe(0)
    expect(out).toContain('changeStatus')
  }, 30_000)
})
