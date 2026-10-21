// Direct dispatch contract: the committed table matches mise.toml and the
// command list, and the CLI passes each child's exit code straight through.
import { describe, expect, test } from 'bun:test'
import * as BunServices from '@effect/platform-bun/BunServices'
import { Effect } from 'effect'
import { ChildProcess, ChildProcessSpawner } from 'effect/process'
import { readTable } from '../../scripts/gen-dispatch.ts'
import { COMMAND_NAMES } from '../../src/cli/commands.ts'
import { commandFor } from '../../src/cli/dispatch.ts'
import { DISPATCH } from '../../src/cli/dispatch-table.ts'
import { runCli } from '../_support/cli.ts'
import { ROOT } from '../_support/root.ts'
import { eff } from '../_support/run.ts'

const cli = (args: string[]) => runCli('bin/webular.ts', args, { exec: process.execPath })
const now = Effect.clockWith((clock) => clock.currentTimeMillis)
const SUMMARIZE = ['summarize', '--text', 'One. Two words here. Three.', '--json']

test(
  'commandFor runs the command on this runtime at the package root',
  eff(
    Effect.gen(function* () {
      const command = yield* commandFor('summarize', ['--json'], { stdout: 'pipe' })
      expect(command).toMatchObject({
        command: process.execPath,
        options: { cwd: ROOT.replace(/[\\/]$/, ''), stdout: 'pipe' },
      })
    }),
  ),
)

test(
  '--no-cache turns the disk cache off in the command process',
  eff(
    Effect.gen(function* () {
      const off = yield* commandFor('scrape', ['--no-cache'])
      const on = yield* commandFor('scrape', [])
      expect(off).toMatchObject({ options: { env: { WEBULAR_NO_CACHE: '1' } } })
      expect(on).not.toMatchObject({ options: { env: { WEBULAR_NO_CACHE: '1' } } })
    }),
  ),
)

describe('dispatch table', () => {
  test(
    'matches the run:* tasks in mise.toml',
    eff(
      Effect.gen(function* () {
        const table = yield* Effect.provide(readTable(ROOT), BunServices.layer)
        expect(DISPATCH).toEqual(table as typeof DISPATCH)
      }),
    ),
  )

  test('has one row per command name', () => {
    expect(Object.keys(DISPATCH).sort()).toEqual([...COMMAND_NAMES].sort())
  })
})

const exitsWith = (args: string[], expected: number) =>
  eff(Effect.map(cli(args), ({ code }) => expect(code).toBe(expected)))

describe('exit codes pass straight through', () => {
  test('0 on success', exitsWith(SUMMARIZE, 0), 30_000)
  test('2 on an unknown command', exitsWith(['no-such-command'], 2), 30_000)
  test('2 on a usage error from the child', exitsWith(['feed'], 2), 30_000)
  test(
    'a failing child ends the CLI promptly',
    eff(
      Effect.gen(function* () {
        const started = yield* now
        yield* cli(['feed'])
        expect((yield* now) - started).toBeLessThan(5_000)
      }),
    ),
    30_000,
  )
})

// The CLI forwards the exact signal it gets, so each exits 128 + its number.
const stopWith = (signal: 'SIGINT' | 'SIGTERM') =>
  Effect.scoped(
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const handle = yield* spawner.spawn(
        ChildProcess.make(process.execPath, [`${ROOT}bin/webular.ts`, 'mcp'], {
          cwd: ROOT,
          stdin: 'pipe',
          stdout: 'ignore',
          stderr: 'ignore',
        }),
      )
      yield* Effect.sleep('3 seconds')
      yield* handle.kill({ killSignal: signal })
      return Number(yield* handle.exitCode)
    }),
  ).pipe(Effect.provide(BunServices.layer))

// Windows has no POSIX signals: killing a process with SIGINT or SIGTERM ends it
// from outside (TerminateProcess, exit code 1), so no handler runs and the CLI
// never sees the signal. Ctrl-C there is a console event this test cannot send.
const posixOnly = test.skipIf(process.platform === 'win32')

describe('signals', () => {
  posixOnly(
    'SIGINT exits 130',
    eff(Effect.map(stopWith('SIGINT'), (code) => expect(code).toBe(130))),
    30_000,
  )
  posixOnly(
    'SIGTERM exits 143',
    eff(Effect.map(stopWith('SIGTERM'), (code) => expect(code).toBe(143))),
    30_000,
  )
})
