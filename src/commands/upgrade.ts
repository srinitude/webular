// UPGRADE command entry — invoked by `mise run run:upgrade`. Reads the latest
// version from https://webular.dev/latest (WEBULAR_LATEST_URL overrides it),
// then names the one command that upgrades this install: the installer receipt
// first, else the channel the executable path shows. It prints that command;
// --yes runs it.
import { join } from 'node:path'
import { Config, Console, Effect, FileSystem, Schema } from 'effect'
import { ChildProcess, ChildProcessSpawner } from 'effect/process'
import pkg from '../../package.json' with { type: 'json' }
import { EXIT } from '../cli/exit-codes.ts'
import { parseFlags } from '../core/args.ts'
import { CliError, runMain } from '../core/effect.ts'
import { httpGet } from '../core/http.ts'
import { errMsg } from '../core/output.ts'
import { receiptCommand, upgradeFor } from '../release/upgrade.ts'

const WINDOWS = process.platform === 'win32'
const envVar = (name: string) => Config.String(name).pipe(Config.withDefault(''))
const fail = (message: string) => new CliError({ message, exitCode: EXIT.failure })

// Where install.sh and install.ps1 write their receipt.
const receiptPath = Effect.gen(function* () {
  if (WINDOWS) return join(yield* envVar('LOCALAPPDATA'), 'webular', 'receipt.json')
  const xdg = (yield* envVar('XDG_CONFIG_HOME')) || join(yield* envVar('HOME'), '.config')
  return join(xdg, 'webular', 'receipt.json')
})

const latestVersion = Effect.gen(function* () {
  const url = (yield* envVar('WEBULAR_LATEST_URL')) || 'https://webular.dev/latest'
  const res = yield* httpGet(url)
  const text = yield* Effect.tryPromise(() => res.text())
  const version = text.trim().replace(/^v/, '')
  if (!res.ok || !/^\d+\.\d+\.\d+$/.test(version))
    return yield* fail(`upgrade: ${url} did not return a version like 1.2.3`)
  return version
}).pipe(Effect.mapError((err) => (err instanceof CliError ? err : fail(`upgrade: ${errMsg(err)}`))))

const decodeReceipt = Schema.decodeUnknownEffect(
  Schema.fromJsonString(Schema.Struct({ source: Schema.optional(Schema.String) })),
)

const fromReceipt = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const receipt = yield* decodeReceipt(yield* fs.readFileString(yield* receiptPath))
  return receiptCommand(receipt.source)
}).pipe(Effect.orElseSucceed(() => undefined))

const NOT_DETECTED =
  'upgrade: could not tell how webular was installed (checked the installer receipt, npm, bun, Homebrew, Scoop, and WinGet). Download it from https://github.com/srinitude/webular/releases/latest'

const upgradeCommand = Effect.gen(function* () {
  const receipt = yield* fromReceipt
  if (receipt) return receipt
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

const main = Effect.gen(function* () {
  const { values } = yield* parseFlags(Bun.argv.slice(2), { yes: { type: 'boolean' } })
  const latest = yield* latestVersion
  if (latest === pkg.version) {
    yield* Console.log(`webular ${pkg.version} is already on latest`)
    return EXIT.ok
  }
  const command = yield* upgradeCommand
  yield* Console.log(`webular ${pkg.version} -> ${latest}\n${command}`)
  if (values['yes'] !== true) {
    yield* Console.error('Run that command, or run `webular upgrade --yes` to run it now.')
    return EXIT.ok
  }
  return yield* runShell(command)
})

runMain(main)
