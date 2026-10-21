// MONITOR contract — real fetch against the local fixture, temp db (no mocks).
import { describe, expect, test } from 'bun:test'
import { readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect } from 'effect'
import { runCli } from '../_support/cli.ts'
import { useFixture } from '../_support/fixture.ts'
import { defaultRoutes } from '../_support/routes.ts'
import { eff } from '../_support/run.ts'

const fx = useFixture(defaultRoutes)

const runMonitor = (args: string[]) => runCli('src/commands/monitor.ts', args)

describe('webular monitor — change tracking across snapshots (real fetch)', () => {
  const dbPath = join(tmpdir(), `webular-monitor-test-${Date.now()}.db`)

  test(
    'first run returns changeStatus "new"',
    eff(
      Effect.gen(function* () {
        const url = `${fx.origin}/c`
        const { code, out, err } = yield* runMonitor(['--url', url, '--db', dbPath, '--json'])
        expect(err).toBe('')
        expect(code).toBe(0)
        const data = JSON.parse(out)
        expect(data.url).toBe(url)
        expect(data.changeStatus).toBe('new')
      }),
    ),
    15_000,
  )

  test(
    'second run with same url returns changeStatus "same"',
    eff(
      Effect.gen(function* () {
        const { code, out, err } = yield* runMonitor([
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
      }),
    ),
    15_000,
  )

  test(
    'exits with code 2 when the URL is missing',
    eff(
      Effect.gen(function* () {
        const { code, err } = yield* runMonitor(['--db', dbPath])
        expect(code).toBe(2)
        expect(err).toContain('missing')
      }),
    ),
  )

  test('cleanup db', eff(Effect.sync(() => rmSync(dbPath, { force: true }))))

  test(
    'default db path is per-user, per-project and stable across runs',
    eff(
      Effect.gen(function* () {
        const stateHome = join(tmpdir(), `webular-state-${Date.now()}`)
        const env: Record<string, string | undefined> = {
          ...process.env,
          XDG_STATE_HOME: stateHome,
        }
        delete env.WEBULAR_DB
        const spawnOnce = () =>
          runCli('src/commands/monitor.ts', ['--url', `${fx.origin}/c`, '--json'], { env })
        const first = yield* spawnOnce()
        const second = yield* spawnOnce()
        expect(first.code).toBe(0)
        expect(JSON.parse(first.out).changeStatus).toBe('new')
        expect(JSON.parse(second.out).changeStatus).toBe('same')
        const files = readdirSync(join(stateHome, 'webular'))
        expect(files.length).toBe(1)
        expect(files[0]).toMatch(/^monitor-[0-9a-f]{12}\.db$/)
        rmSync(stateHome, { recursive: true, force: true })
      }),
    ),
    20_000,
  )

  test(
    'per-project key follows the INVOKING directory, not the process cwd',
    eff(
      Effect.gen(function* () {
        // The gateway pins command-process cwd to the package root and exports
        // WEBULAR_INVOKE_DIR — two projects must get two databases.
        const stateHome = join(tmpdir(), `webular-state-inv-${Date.now()}`)
        const spawnFrom = (invokeDir: string) => {
          const env: Record<string, string | undefined> = {
            ...process.env,
            XDG_STATE_HOME: stateHome,
            WEBULAR_INVOKE_DIR: invokeDir,
          }
          delete env.WEBULAR_DB
          return runCli('src/commands/monitor.ts', ['--url', `${fx.origin}/c`, '--json'], {
            env,
          }).pipe(Effect.map((r) => r.code))
        }
        const dirA = join(tmpdir(), `webular-proj-a-${Date.now()}`)
        const dirB = join(tmpdir(), `webular-proj-b-${Date.now()}`)
        for (const d of [dirA, dirB]) Bun.spawnSync(['mkdir', '-p', d])
        expect(yield* spawnFrom(dirA)).toBe(0)
        expect(yield* spawnFrom(dirB)).toBe(0)
        const files = readdirSync(join(stateHome, 'webular'))
        expect(files.length).toBe(2)
        rmSync(stateHome, { recursive: true, force: true })
        for (const d of [dirA, dirB]) rmSync(d, { recursive: true, force: true })
      }),
    ),
    25_000,
  )
})
