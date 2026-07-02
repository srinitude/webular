// Fresh-env gateway contract (B20 + global-install): bundled-mise fallback
// when PATH has none, package-root cwd (a global install runs from anywhere),
// trust bootstrap for our own shipped config, invoke-dir-relative -o, and the
// help/version bypass that needs no mise at all.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runCli } from '../_support/cli.ts'
import { type Fixture, startFixture } from '../_support/fixture.ts'
import { ROOT } from '../_support/root.ts'
import { defaultRoutes } from '../_support/routes.ts'

let fx: Fixture
let dir: string
beforeAll(() => {
  fx = startFixture(defaultRoutes)
  dir = mkdtempSync(join(tmpdir(), 'webular-gw-'))
})
afterAll(() => {
  fx.stop()
  rmSync(dir, { recursive: true, force: true })
})

const runWebular = (
  args: string[],
  opts: { cwd?: string; env?: Record<string, string | undefined> } = {},
) => runCli('bin/webular.ts', args, { ...opts, exec: process.execPath })

describe('gateway — fresh-environment routing', () => {
  test('--help and --version bypass mise entirely', async () => {
    const env = { ...process.env, PATH: '/usr/bin:/bin' }
    const help = await runWebular(['--help'], { env })
    expect(help.code).toBe(0)
    expect(help.out).toContain('USAGE')
    const version = await runWebular(['--version'], { env })
    expect(version.code).toBe(0)
    expect(version.out).toContain('webular')
  }, 20_000)

  test('routes a command from a foreign cwd (global-install shape)', async () => {
    const { code, out } = await runWebular(['diagram', '--list', '--json'], { cwd: dir })
    expect(code).toBe(0)
    expect(JSON.parse(out).count).toBeGreaterThanOrEqual(7)
  }, 30_000)

  test('falls back to the bundled mise binary when PATH has none', async () => {
    const env = { ...process.env, PATH: '/usr/bin:/bin' }
    const { code, out } = await runWebular(['diagram', '--list', '--json'], { cwd: dir, env })
    expect(code).toBe(0)
    expect(JSON.parse(out).count).toBeGreaterThanOrEqual(7)
  }, 30_000)

  test('bootstraps trust for its own config under a fresh mise state dir', async () => {
    const stateDir = join(dir, 'mise-state')
    const env = { ...process.env, MISE_STATE_DIR: stateDir }
    const { code, out, err } = await runWebular(['diagram', '--list', '--json'], {
      cwd: dir,
      env,
    })
    expect(err).not.toContain('trust')
    expect(code).toBe(0)
    expect(JSON.parse(out).count).toBeGreaterThanOrEqual(7)
  }, 30_000)

  test('relative -o lands in the invoking directory, not the package root', async () => {
    const { code } = await runWebular(['scrape', '--url', `${fx.origin}/`, '-o', 'gw-out.md'], {
      cwd: dir,
    })
    expect(code).toBe(0)
    expect(existsSync(join(dir, 'gw-out.md'))).toBe(true)
    expect(readFileSync(join(dir, 'gw-out.md'), 'utf8')).toContain('Fixture Home')
    expect(existsSync(join(ROOT, 'gw-out.md'))).toBe(false)
  }, 30_000)
})
