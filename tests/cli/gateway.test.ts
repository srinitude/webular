// Fresh-env dispatch contract (global-install shape): with no mise on PATH the
// CLI still starts every command, at the package root, from any directory, and
// a relative -o lands where the user is standing.
import { describe, expect, test } from 'bun:test'
import { Effect, FileSystem, Path } from 'effect'
import { runCli } from '../_support/cli.ts'
import { useFixture } from '../_support/fixture.ts'
import { ROOT } from '../_support/root.ts'
import { defaultRoutes } from '../_support/routes.ts'
import { eff, tmpDir } from '../_support/run.ts'

const fx = useFixture(defaultRoutes)

// A PATH with no mise and no bun: the CLI runs commands on its own runtime.
const NO_MISE = { ...process.env, PATH: '/usr/bin:/bin' }

const runWebular = (args: string[], cwd?: string) =>
  runCli('bin/webular.ts', args, { ...(cwd ? { cwd } : {}), env: NO_MISE, exec: process.execPath })

const helpCase = Effect.gen(function* () {
  const help = yield* runWebular(['--help'])
  expect(help.code).toBe(0)
  expect(help.out).toContain('USAGE')
  const version = yield* runWebular(['--version'])
  expect(version.code).toBe(0)
  expect(version.out).toContain('webular')
})

const foreignCwdCase = Effect.gen(function* () {
  const dir = yield* tmpDir('webular-gw-')
  const args = ['summarize', '--text', 'One. Two words here. Three.', '--json']
  const { code, out } = yield* runWebular(args, dir)
  expect(code).toBe(0)
  expect(JSON.parse(out)).toBeObject()
})

const relativeOutCase = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const dir = yield* tmpDir('webular-gw-')
  const args = ['scrape', '--url', `${fx.origin}/`, '-o', 'gw-out.md']
  const { code } = yield* runWebular(args, dir)
  expect(code).toBe(0)
  expect(yield* fs.readFileString(path.join(dir, 'gw-out.md'))).toContain('Fixture Home')
  expect(yield* fs.exists(path.join(ROOT, 'gw-out.md'))).toBe(false)
})

describe('dispatch — fresh environment, no mise on PATH', () => {
  test(
    'an unknown command exits 2 with a usage hint',
    eff(
      Effect.gen(function* () {
        const { code, err } = yield* runWebular(['nonesuch'])
        expect(code).toBe(2)
        expect(err).toContain("unknown command 'nonesuch'")
      }),
    ),
    20_000,
  )
  test('--help and --version need nothing on PATH', eff(helpCase), 20_000)
  test('routes a command from a foreign cwd', eff(foreignCwdCase), 30_000)
  test(
    'relative -o lands in the invoking directory, not the package root',
    eff(relativeOutCase),
    30_000,
  )
})
