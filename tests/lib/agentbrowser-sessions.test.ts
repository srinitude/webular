// No browser session outlives its run: every batch names a webular session
// (never agent-browser's idle-forever `default`), repeat batches in one run
// reuse it warm, and the run's end (closeBrowserSessions, which runWorkflow's
// disposeSteps calls) closes each one exactly once. A compiled stub
// `agent-browser` first on PATH logs each call's argv and first command. It
// appends one line in one write: closeSessions closes sessions in parallel, and
// a read-then-rewrite log lost one close's line whenever two stubs overlapped.
import { expect, test } from 'bun:test'
import { platform } from 'node:os'
import { delimiter } from 'node:path'
import { Config, Effect, FileSystem } from 'effect'
import { runProc } from '../../src/core/proc.ts'
import { ROOT } from '../_support/root.ts'
import { eff, tmpDir } from '../_support/run.ts'

const CHILD = `import { Effect } from 'effect'
import { runBatch } from './src/lib/agentbrowser.ts'
import { closeBrowserSessions, stepRuntime } from './src/workflows/runtime.ts'
await stepRuntime.runPromise(runBatch([['open', 'https://x.test/a']], 'webular-run'))
await stepRuntime.runPromise(runBatch([['open', 'https://x.test/b']], 'webular-run'))
await stepRuntime.runPromise(runBatch([['open', 'https://x.test/c']]))
await Effect.runPromise(closeBrowserSessions)
await Effect.runPromise(closeBrowserSessions)`

const stubSource = (dir: string) => `import { appendFile } from 'node:fs/promises'
const commands: string[][] = await Bun.stdin.json()
const idle = process.env['AGENT_BROWSER_IDLE_TIMEOUT_MS'] ?? 'none'
await appendFile(${JSON.stringify(dir)} + '/calls', [...process.argv.slice(2), commands[0]?.[0], idle].join(' ') + '\\n')`

test.skipIf(platform() === 'win32')(
  'a run closes every browser session it opened, once, and never uses the default session',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const stubs = yield* tmpDir('webular-session-stub-')
      yield* fs.writeFileString(`${stubs}/stub.ts`, stubSource(stubs))
      const build = yield* runProc(
        ['bun', 'build', '--compile', `${stubs}/stub.ts`, '--outfile', `${stubs}/agent-browser`],
        { timeoutMs: 60_000, cwd: ROOT },
      )
      expect([build.code, build.stderr]).toEqual([0, ''])
      const PATH = yield* Config.String('PATH')
      const res = yield* runProc(['bun', '-e', CHILD], {
        timeoutMs: 60_000,
        cwd: ROOT,
        env: { PATH: `${stubs}${delimiter}${PATH}` },
        extendEnv: true,
      })
      expect([res.code, res.stderr]).toEqual([0, ''])
      const calls = (yield* fs.readFileString(`${stubs}/calls`)).trim().split('\n').sort()
      expect(calls).toEqual([
        '--session webular batch --bail close 120000',
        '--session webular batch --bail open 120000',
        '--session webular-run batch --bail close 120000',
        '--session webular-run batch --bail open 120000',
        '--session webular-run batch --bail open 120000',
      ])
    }),
  ),
  120_000,
)
