// The agent-browser driver retries a failed render once, but only when a retry
// can fix it: a connection, a timeout, or a server hiccup. A page that is gone
// or a bad command fails at once. A stub `agent-browser` (compiled Bun, so it
// runs on Windows too) counts its calls and fails with the case's stderr and
// exit code; a child process with the stub first on PATH renders one page.
import { expect, test } from 'bun:test'
import { platform } from 'node:os'
import { delimiter } from 'node:path'
import { Config, Effect, FileSystem } from 'effect'
import { runProc } from '../../src/core/proc.ts'
import { ROOT } from '../_support/root.ts'
import { eff, tmpDir } from '../_support/run.ts'

const CHILD = `import { Effect } from 'effect'
import { AgentBrowserLive, Driver } from './src/lib/driver.ts'
await Effect.runPromiseExit(Effect.provide(
  Driver.use((d) => d.render('https://x.test/')),
  AgentBrowserLive,
))`

const stubSource = (dir: string) => `const dir = ${JSON.stringify(dir)}
await Bun.stdin.text()
const { err, code } = await Bun.file(dir + '/case.json').json()
const calls = await Bun.file(dir + '/calls').text().catch(() => '')
await Bun.write(dir + '/calls', calls + 'x')
process.stderr.write(err)
process.exit(code)`

// [name, stderr, exit code, calls expected]: 2 = retried once, 1 = failed at once.
const CASES: [string, string, number, number][] = [
  ['ECONNRESET', 'read ECONNRESET', 1, 2],
  ['ECONNREFUSED', 'connect ECONNREFUSED 127.0.0.1:9222', 1, 2],
  ['cold daemon', 'Failed to connect to daemon', 1, 2],
  ['HTTP 429', 'navigation failed: HTTP 429 Too Many Requests', 1, 2],
  ['HTTP 503', 'navigation failed: HTTP 503 Service Unavailable', 1, 2],
  ['timeout text', 'navigation timed out after 30000ms', 1, 2],
  ['killed on timeout (exit 143)', '', 143, 2],
  ['HTTP 404', 'navigation failed: HTTP 404 Not Found', 1, 1],
  ['unknown command', 'unknown command: frobnicate', 2, 1],
  ['invalid selector', 'invalid selector: ##', 1, 1],
]

test.skipIf(platform() === 'win32')(
  'a failed render retries once only when a retry can fix it',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const stubs = yield* tmpDir('webular-driver-stub-')
      yield* fs.writeFileString(`${stubs}/stub.ts`, stubSource(stubs))
      const build = yield* runProc(
        ['bun', 'build', '--compile', `${stubs}/stub.ts`, '--outfile', `${stubs}/agent-browser`],
        { timeoutMs: 60_000, cwd: ROOT },
      )
      expect([build.code, build.stderr]).toEqual([0, ''])
      const PATH = yield* Config.String('PATH')
      const callsFor = (err: string, code: number) =>
        Effect.gen(function* () {
          yield* fs.writeFileString(`${stubs}/case.json`, JSON.stringify({ err, code }))
          yield* fs.remove(`${stubs}/calls`, { force: true })
          yield* runProc(['bun', '-e', CHILD], {
            timeoutMs: 60_000,
            cwd: ROOT,
            env: { PATH: `${stubs}${delimiter}${PATH}` },
            extendEnv: true,
          })
          return (yield* fs.readFileString(`${stubs}/calls`)).length
        })
      const seen: Record<string, number> = {}
      const want: Record<string, number> = {}
      for (const [name, err, code, calls] of CASES) {
        seen[name] = yield* callsFor(err, code)
        want[name] = calls
      }
      expect(seen).toEqual(want)
    }),
  ),
  180_000,
)
