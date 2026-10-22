// UPGRADE command entry — invoked by `mise run run:upgrade`. Reads the latest
// version from https://webular.dev/latest (WEBULAR_LATEST_URL overrides it),
// then names the one command that upgrades this install, from the channel the
// executable path shows. It prints that command; --yes runs it.
import { Config, Console, Effect } from 'effect'
import { ChildProcess, ChildProcessSpawner } from 'effect/process'
import pkg from '../../package.json' with { type: 'json' }
import { EXIT, settledExit } from '../cli/exit-codes.ts'
import { parseFlags } from '../core/args.ts'
import { CliError, runMain } from '../core/effect.ts'
import { httpGet } from '../core/http.ts'
import { errMsg } from '../core/output.ts'
import { commandLifecycleMachine } from '../machines/command-lifecycle.ts'
import { upgradeFor } from '../release/upgrade.ts'

const WINDOWS = process.platform === 'win32'
const envVar = (name: string) => Config.String(name).pipe(Config.withDefault(''))
const fail = (message: string) => new CliError({ message, exitCode: EXIT.failure })

const latestVersion = Effect.gen(function* () {
  const url = (yield* envVar('WEBULAR_LATEST_URL')) || 'https://webular.dev/latest'
  const res = yield* httpGet(url)
  const text = yield* Effect.tryPromise(() => res.text())
  const version = text.trim().replace(/^v/, '')
  if (!res.ok || !/^\d+\.\d+\.\d+$/.test(version))
    return yield* fail(`upgrade: ${url} did not return a version like 1.2.3`)
  return version
}).pipe(Effect.mapError((err) => (err instanceof CliError ? err : fail(`upgrade: ${errMsg(err)}`))))

const NOT_DETECTED =
  'upgrade: could not tell how webular was installed (checked the install path for install.sh, install.ps1, npm, bun, Homebrew, Scoop, and WinGet). Download it from https://github.com/srinitude/webular/releases/latest'

const upgradeCommand = Effect.gen(function* () {
  const WEBULAR_INSTALL = yield* envVar('WEBULAR_INSTALL')
  const found = upgradeFor([process.execPath, Bun.argv[1] ?? ''], { WEBULAR_INSTALL })
  return found.channel === 'unknown' ? yield* fail(NOT_DETECTED) : found.command
})

const runShell = (command: string) =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const [bin, args] = WINDOWS
      ? ['powershell', ['-NoProfile', '-Command', command]]
      : ['sh', ['-c', command]]
    const handle = yield* spawner.spawn(
      ChildProcess.make(bin, args, { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' }),
    )
    return Number(yield* handle.exitCode)
  }).pipe(Effect.scoped)

// A printed answer settles the command lifecycle machine like a rendered result.
const printed = () =>
  settledExit(commandLifecycleMachine, [
    { type: 'INPUT_VALID' },
    { type: 'WORKFLOW_SUCCEEDED' },
    { type: 'NO_ERRORS' },
  ])

const main = Effect.gen(function* () {
  const { values } = yield* parseFlags(Bun.argv.slice(2), { yes: { type: 'boolean' } })
  const latest = yield* latestVersion
  if (latest === pkg.version) {
    yield* Console.log(`webular ${pkg.version} is already on latest`)
    return printed()
  }
  const command = yield* upgradeCommand
  yield* Console.log(`webular ${pkg.version} -> ${latest}\n${command}`)
  if (values['yes'] !== true) {
    yield* Console.error('Run that command, or run `webular upgrade --yes` to run it now.')
    return printed()
  }
  return yield* runShell(command)
})

runMain(main)
