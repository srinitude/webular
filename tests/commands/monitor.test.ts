// MONITOR contract — real fetch against the local fixture, temp db (no mocks).
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { readdirSync, rmSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runCli } from '../_support/cli.ts'
import { type Fixture, startFixture } from '../_support/fixture.ts'
import { ROOT } from '../_support/root.ts'
import { defaultRoutes } from '../_support/routes.ts'

let fx: Fixture
beforeAll(() => {
  fx = startFixture(defaultRoutes)
})
afterAll(() => fx.stop())

const runMonitor = (args: string[]) => runCli('src/commands/monitor.ts', args)

describe('webular monitor — change tracking across snapshots (real fetch)', () => {
  const dbPath = join(tmpdir(), `webular-monitor-test-${Date.now()}.db`)

  test('first run returns changeStatus "new"', async () => {
    const url = `${fx.origin}/c`
    const { code, out, err } = await runMonitor(['--url', url, '--db', dbPath, '--json'])
    expect(err).toBe('')
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(data.url).toBe(url)
    expect(data.changeStatus).toBe('new')
  }, 15_000)

  test('second run with same url returns changeStatus "same"', async () => {
    const { code, out, err } = await runMonitor([
      '--url',
      `${fx.origin}/c`,
      '--db',
      dbPath,
      '--json',
    ])
    expect(err).toBe('')
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(data.changeStatus).toBe('same')
  }, 15_000)

  test('exits with code 2 when the URL is missing', async () => {
    const { code, err } = await runMonitor(['--db', dbPath])
    expect(code).toBe(2)
    expect(err).toContain('missing')
  })

  test('cleanup db', () => {
    try {
      unlinkSync(dbPath)
    } catch {
      /* already gone */
    }
  })

  test('default db path is per-user, per-project and stable across runs', async () => {
    const stateHome = join(tmpdir(), `webular-state-${Date.now()}`)
    const env: Record<string, string | undefined> = {
      ...process.env,
      XDG_STATE_HOME: stateHome,
    }
    delete env.WEBULAR_DB
    const spawnOnce = () =>
      runCli('src/commands/monitor.ts', ['--url', `${fx.origin}/c`, '--json'], { env })
    const first = await spawnOnce()
    const second = await spawnOnce()
    expect(first.code).toBe(0)
    expect(JSON.parse(first.out).changeStatus).toBe('new')
    expect(JSON.parse(second.out).changeStatus).toBe('same')
    const files = readdirSync(join(stateHome, 'webular'))
    expect(files.length).toBe(1)
    expect(files[0]).toMatch(/^monitor-[0-9a-f]{12}\.db$/)
    rmSync(stateHome, { recursive: true, force: true })
  }, 20_000)

  test('per-project key follows the INVOKING directory, not the process cwd', async () => {
    // The gateway pins command-process cwd to the package root and exports
    // WEBULAR_INVOKE_DIR — two projects must get two databases.
    const stateHome = join(tmpdir(), `webular-state-inv-${Date.now()}`)
    const spawnFrom = async (invokeDir: string): Promise<number> => {
      const env: Record<string, string | undefined> = {
        ...process.env,
        XDG_STATE_HOME: stateHome,
        WEBULAR_INVOKE_DIR: invokeDir,
      }
      delete env.WEBULAR_DB
      const { code } = await runCli(
        'src/commands/monitor.ts',
        ['--url', `${fx.origin}/c`, '--json'],
        { env },
      )
      return code
    }
    const dirA = join(tmpdir(), `webular-proj-a-${Date.now()}`)
    const dirB = join(tmpdir(), `webular-proj-b-${Date.now()}`)
    for (const d of [dirA, dirB]) Bun.spawnSync(['mkdir', '-p', d])
    expect(await spawnFrom(dirA)).toBe(0)
    expect(await spawnFrom(dirB)).toBe(0)
    const files = readdirSync(join(stateHome, 'webular'))
    expect(files.length).toBe(2)
    rmSync(stateHome, { recursive: true, force: true })
    for (const d of [dirA, dirB]) rmSync(d, { recursive: true, force: true })
  }, 25_000)
})
