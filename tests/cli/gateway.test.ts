// Fresh-env gateway contract (B20 + global-install): bundled-mise fallback
// when PATH has none, package-root cwd (a global install runs from anywhere),
// trust bootstrap for our own shipped config, invoke-dir-relative -o, and the
// help/version bypass that needs no mise at all.
import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Effect } from 'effect'
import { runCli } from '../_support/cli.ts'
import { useFixture } from '../_support/fixture.ts'
import { ROOT } from '../_support/root.ts'
import { defaultRoutes } from '../_support/routes.ts'
import { eff, tmpDir } from '../_support/run.ts'

const fx = useFixture(defaultRoutes)

const runWebular = (
  args: string[],
  opts: { cwd?: string; env?: Record<string, string | undefined> } = {},
) => runCli('bin/webular.ts', args, { ...opts, exec: process.execPath })

const barePath = () => ({ ...process.env, PATH: '/usr/bin:/bin' })

const helpCase = Effect.gen(function* () {
  const env = barePath()
  const help = yield* runWebular(['--help'], { env })
  expect(help.code).toBe(0)
  expect(help.out).toContain('USAGE')
  const version = yield* runWebular(['--version'], { env })
  expect(version.code).toBe(0)
  expect(version.out).toContain('webular')
})

const foreignCwdCase = Effect.gen(function* () {
  const dir = yield* tmpDir('webular-gw-')
  const { code, out } = yield* runWebular(['diagram', '--list', '--json'], { cwd: dir })
  expect(code).toBe(0)
  expect(JSON.parse(out).count).toBeGreaterThanOrEqual(3)
})

const bundledMiseCase = Effect.gen(function* () {
  const dir = yield* tmpDir('webular-gw-')
  const env = barePath()
  const { code, out } = yield* runWebular(['diagram', '--list', '--json'], { cwd: dir, env })
  expect(code).toBe(0)
  expect(JSON.parse(out).count).toBeGreaterThanOrEqual(3)
})

const trustCase = Effect.gen(function* () {
  const dir = yield* tmpDir('webular-gw-')
  const env = { ...process.env, MISE_STATE_DIR: join(dir, 'mise-state') }
  const { code, out, err } = yield* runWebular(['diagram', '--list', '--json'], { cwd: dir, env })
  expect(err).not.toContain('trust')
  expect(code).toBe(0)
  expect(JSON.parse(out).count).toBeGreaterThanOrEqual(3)
})

const relativeOutCase = Effect.gen(function* () {
  const dir = yield* tmpDir('webular-gw-')
  const args = ['scrape', '--url', `${fx.origin}/`, '-o', 'gw-out.md']
  const { code } = yield* runWebular(args, { cwd: dir })
  expect(code).toBe(0)
  expect(existsSync(join(dir, 'gw-out.md'))).toBe(true)
  expect(readFileSync(join(dir, 'gw-out.md'), 'utf8')).toContain('Fixture Home')
  expect(existsSync(join(ROOT, 'gw-out.md'))).toBe(false)
})

describe('gateway — fresh-environment routing', () => {
  test('--help and --version bypass mise entirely', eff(helpCase), 20_000)
  test('routes a command from a foreign cwd (global-install shape)', eff(foreignCwdCase), 30_000)

  // The mise npm package publishes no Windows binary, so there is no bundled
  // fallback to exercise there; Windows users install mise on PATH.
  test.skipIf(process.platform === 'win32')(
    'falls back to the bundled mise binary when PATH has none',
    eff(bundledMiseCase),
    30_000,
  )

  test('bootstraps trust for its own config under a fresh mise state dir', eff(trustCase), 30_000)
  test(
    'relative -o lands in the invoking directory, not the package root',
    eff(relativeOutCase),
    30_000,
  )
})
