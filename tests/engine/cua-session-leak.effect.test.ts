// A cua session that opened ends even when a later open step fails: a fake
// cua-driver first on PATH logs each tool and fails get_browser_state, and a
// throwaway "browser" (a sleeping shell with --user-data-dir) passes the guard.
import { expect, test } from 'bun:test'
import { Effect, FileSystem, Path } from 'effect'
import { ChildProcess, ChildProcessSpawner } from 'effect/process'
import { runProc } from '../../src/core/proc.ts'
import { ROOT } from '../_support/root.ts'
import { eff, tmpDir } from '../_support/run.ts'

const FAKE = `#!/bin/sh
echo "$2" >> "$(dirname "$0")/calls.log"
[ "$2" = get_browser_state ] && exit 1
echo '{}'
`

test(
  'a failed cua open still ends the session it started',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const dir = yield* tmpDir('webular-cua-leak-')
      const bin = path.join(dir, 'cua-driver')
      yield* fs.writeFileString(bin, FAKE)
      yield* fs.chmod(bin, 0o755)
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const browser = yield* spawner.spawn(
        ChildProcess.make('sh', ['-c', 'sleep 30; :', 'sh', `--user-data-dir=${dir}/profile`]),
      )
      const res = yield* runProc([process.execPath, `${ROOT}tests/engine/cua-open-once.ts`], {
        timeoutMs: 30_000,
        extendEnv: true,
        env: { PATH: `${dir}:/usr/bin:/bin`, WEBULAR_CUA_WINDOW: `${browser.pid}:1` },
      })
      expect(res.stdout.trim()).toBe('Failure')
      const calls = (yield* fs.readFileString(path.join(dir, 'calls.log'))).trim().split('\n')
      expect(calls).toEqual(['start_session', 'get_browser_state', 'end_session'])
    }),
  ),
)
