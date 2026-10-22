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

// The launcher runs the Bun fake driver; Windows finds a `.cmd` through PATHEXT, other systems an sh file.
const WIN = process.platform === 'win32'

const writeLauncher = (dir: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const driver = `${ROOT}tests/engine/cua-fake-driver.ts`
    const bin = path.join(dir, WIN ? 'cua-driver.cmd' : 'cua-driver')
    const body = WIN
      ? `@"${process.execPath}" "${driver}" %*\r\n`
      : `#!/bin/sh\nexec "${process.execPath}" "${driver}" "$@"\n`
    yield* fs.writeFileString(bin, body)
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
      expect(res.stdout.trim()).toBe('Failure')
      const calls = (yield* fs.readFileString(path.join(dir, 'calls.log'))).trim().split('\n')
      expect(calls).toEqual(['start_session', 'get_browser_state', 'end_session'])
    }),
  ),
)
