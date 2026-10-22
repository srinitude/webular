// A cua session that opened ends even when a later open step fails: a fake
// cua-driver first on PATH logs each tool and fails get_browser_state, and a
// throwaway "browser" (a sleeping Bun script with --user-data-dir) passes the guard.
import { expect, test } from 'bun:test'
import { delimiter } from 'node:path'
import { Config, Effect, FileSystem, Path } from 'effect'
import { ChildProcess, ChildProcessSpawner } from 'effect/process'
import { runProc } from '../../src/core/proc.ts'
import { ROOT } from '../_support/root.ts'
import { eff, tmpDir } from '../_support/run.ts'

// The fake driver must be found and spawned the way the real one is. Windows
// spawns no `.cmd` without a shell (Node's EINVAL since CVE-2024-27980), and the
// real cua-driver there is an `.exe`, so Windows compiles the Bun fake to one;
// other systems get an sh launcher.
const WIN = process.platform === 'win32'

const writeLauncher = (dir: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const driver = `${ROOT}tests/engine/cua-fake-driver.ts`
    if (WIN) {
      const out = path.join(dir, 'cua-driver.exe')
      const res = yield* runProc(
        [process.execPath, 'build', '--compile', driver, '--outfile', out],
        { timeoutMs: 60_000 },
      )
      return expect({ code: res.code, stderr: res.stderr }).toEqual({ code: 0, stderr: '' })
    }
    const bin = path.join(dir, 'cua-driver')
    yield* fs.writeFileString(bin, `#!/bin/sh\nexec "${process.execPath}" "${driver}" "$@"\n`)
    yield* fs.chmod(bin, 0o755)
  })

test(
  'a failed cua open still ends the session it started',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const dir = yield* tmpDir('webular-cua-leak-')
      yield* writeLauncher(dir)
      const PATH = yield* Config.String('PATH').pipe(Config.orElse(() => Config.String('Path')))
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const browser = yield* spawner.spawn(
        ChildProcess.make(process.execPath, [
          `${ROOT}tests/engine/cua-fake-browser.ts`,
          `--user-data-dir=${path.join(dir, 'profile')}`,
        ]),
      )
      const res = yield* runProc([process.execPath, `${ROOT}tests/engine/cua-open-once.ts`], {
        timeoutMs: 30_000,
        extendEnv: true,
        env: {
          // Windows keeps its own Path key beside an added PATH and either can win,
          // so both name the fake driver's folder first.
          PATH: `${dir}${delimiter}${PATH}`,
          Path: `${dir}${delimiter}${PATH}`,
          FAKE_CUA_LOG: path.join(dir, 'calls.log'),
          WEBULAR_CUA_WINDOW: `${browser.pid}:1`,
        },
      })
      // stderr carries the open's failure cause, so a wrong failure shows why.
      const calls = yield* Effect.orElseSucceed(
        fs.readFileString(path.join(dir, 'calls.log')),
        () => '',
      )
      expect({
        stdout: res.stdout.trim(),
        calls: calls.trim().split(/\r?\n/),
        stderr: res.stderr,
      }).toEqual({
        stdout: 'Failure',
        calls: ['start_session', 'get_browser_state', 'end_session'],
        stderr: expect.stringContaining('get_browser_state'),
      })
    }),
  ),
  60_000,
)
