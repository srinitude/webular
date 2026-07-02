// Bucket A contract: WEBULAR_SANDBOX=1 confines output paths (opt-in). Real
// command runs against the local fixture; default behavior is covered elsewhere.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runCli } from '../_support/cli.ts'
import { type Fixture, startFixture } from '../_support/fixture.ts'
import { ROOT } from '../_support/root.ts'
import { defaultRoutes } from '../_support/routes.ts'

const OUT = '.tmp-sandbox-out.md'

let fx: Fixture
beforeAll(() => {
  fx = startFixture(defaultRoutes)
})
afterAll(async () => {
  fx.stop()
  await rm(`${ROOT}${OUT}`, { force: true })
  await rm(`${ROOT}webular-monitor.db`, { force: true })
})

const scrape = (args: string[]) =>
  runCli('src/commands/scrape.ts', ['--url', `${fx.origin}/`, ...args], {
    env: { ...process.env, WEBULAR_SANDBOX: '1' },
  })

describe('WEBULAR_SANDBOX confines output paths (opt-in hardening)', () => {
  test('rejects an absolute -o path', async () => {
    const { code, err } = await scrape(['-o', '/tmp/webular-evil.md'])
    expect(code).not.toBe(0)
    expect(err.toLowerCase()).toContain('sandbox')
  }, 15_000)

  test('rejects a parent-directory -o path', async () => {
    const { code, err } = await scrape(['-o', '../escape.md'])
    expect(code).not.toBe(0)
    expect(err.toLowerCase()).toContain('sandbox')
  }, 15_000)

  test('allows a contained relative -o path', async () => {
    const { code } = await scrape(['-o', OUT])
    expect(code).toBe(0)
  }, 15_000)

  test('rejects a path through a symlinked parent directory', async () => {
    const base = await mkdtemp(join(tmpdir(), 'webular-sb-'))
    const target = await mkdtemp(join(tmpdir(), 'webular-tgt-'))
    await symlink(target, join(base, 'link'))
    const { code, err } = await runCli(
      'src/commands/scrape.ts',
      ['--url', `${fx.origin}/`, '-o', 'link/evil.md'],
      { env: { ...process.env, WEBULAR_SANDBOX: '1', WEBULAR_OUTPUT_DIR: base } },
    )
    await rm(base, { recursive: true, force: true })
    await rm(target, { recursive: true, force: true })
    expect(code).not.toBe(0)
    expect(err.toLowerCase()).toContain('sandbox')
  }, 15_000)

  test('sandboxed monitor accepts its default database path', async () => {
    const { code, out } = await runCli(
      'src/commands/monitor.ts',
      ['--url', `${fx.origin}/c`, '--json'],
      { env: { ...process.env, WEBULAR_SANDBOX: '1' } },
    )
    expect(code).toBe(0)
    expect(out).toContain('changeStatus')
  }, 15_000)

  test('sandbox anchors to the INVOKING directory when routed (gateway cwd is the package root)', async () => {
    const base = await mkdtemp(join(tmpdir(), 'webular-sb-inv-'))
    const { code } = await runCli(
      'src/commands/scrape.ts',
      ['--url', `${fx.origin}/`, '-o', 'inv-out.md'],
      { env: { ...process.env, WEBULAR_SANDBOX: '1', WEBULAR_INVOKE_DIR: base } },
    )
    const written = await Bun.file(join(base, 'inv-out.md')).exists()
    await rm(base, { recursive: true, force: true })
    await rm(`${ROOT}inv-out.md`, { force: true })
    expect(code).toBe(0)
    expect(written).toBe(true)
  }, 15_000)

  test('sandbox confines WRITES but does not reject absolute READ inputs', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'webular-sb-read-'))
    const file = join(dir, 'note.txt')
    await Bun.write(file, 'readable sandbox input')
    const { code, out } = await runCli('src/commands/parse.ts', ['--file', file, '--json'], {
      env: { ...process.env, WEBULAR_SANDBOX: '1' },
    })
    await rm(dir, { recursive: true, force: true })
    expect(code).toBe(0)
    expect(out).toContain('readable sandbox input')
  }, 15_000)
})
