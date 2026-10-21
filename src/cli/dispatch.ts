// Direct dispatch: start a command's own process from the generated table
// (mise.toml's run:* tasks), with no mise process in between. The CLI still
// never imports command code: each command runs in its own process, at the
// package root, with the user's directory exported for relative paths.
import { join } from 'node:path'
import { Config, Effect, FileSystem } from 'effect'
import { ChildProcess, ChildProcessSpawner } from 'effect/process'
import { CliError, receivedSignal, signalExit } from '../core/effect.ts'
import { errMsg, logErr } from '../core/output.ts'
import { packageRoot } from '../core/root.ts'
import type { CommandName } from './commands.ts'
import { DISPATCH } from './dispatch-table.ts'
import { EXIT } from './exit-codes.ts'

interface DispatchOpts {
  stdout?: 'inherit' | 'pipe'
}

const noRoot = new CliError({
  message: 'webular: package root not found (no mise.toml above the CLI); reinstall webular.',
  exitCode: EXIT.toolchainMissing,
})

// The Bun rung of the launcher: WEBULAR_DEV runs src/; otherwise dist/, falling
// back to src/ when the bundle was never built.
const entryFor = Effect.fn('dispatch.entry')(function* (root: string, stem: string) {
  const fs = yield* FileSystem.FileSystem
  const dev = yield* Config.String('WEBULAR_DEV').pipe(Config.withDefault(''))
  const src = join(root, 'src', 'commands', `${stem}.ts`)
  if (dev !== '') return src
  const dist = join(root, 'dist', 'commands', `${stem}.js`)
  const built = yield* fs.exists(dist).pipe(Effect.orElseSucceed(() => false))
  return built ? dist : src
})

// The child runs on this process's own runtime: bun, or the compiled webular
// acting as bun (BUN_BE_BUN=1), so no second runtime is needed.
export const commandFor = Effect.fn('dispatch.commandFor')(function* (
  name: CommandName,
  args: ReadonlyArray<string>,
  opts: DispatchOpts = {},
) {
  const root = yield* packageRoot
  if (root === null) return yield* noRoot
  const entry = yield* entryFor(root, DISPATCH[name])
  return ChildProcess.make(process.execPath, [entry, ...args], {
    cwd: root,
    env: {
      WEBULAR_INVOKE_DIR: process.cwd(),
      ...(Bun.isStandaloneExecutable ? { BUN_BE_BUN: '1' } : {}),
      // --no-cache reaches the disk cache as its env switch.
      ...(args.includes('--no-cache') ? { WEBULAR_NO_CACHE: '1' } : {}),
    },
    extendEnv: true,
    detached: false,
    stdin: 'inherit',
    stdout: opts.stdout ?? 'inherit',
    stderr: 'inherit',
  })
})

// A child killed by a signal reports it only in the error text.
const KILLED = /signal: '(\w+)'/

const exitOf = (handle: ChildProcessSpawner.ChildProcessHandle) =>
  handle.exitCode.pipe(
    Effect.map(Number),
    Effect.catch((err) => {
      const signal = KILLED.exec(errMsg(err))?.[1]
      return signal
        ? Effect.succeed(signalExit(signal))
        : Effect.as(logErr(errMsg(err)), EXIT.failure)
    }),
  )

// Exit codes: the child's own; 128 + n when a signal kills it; 127 when it
// cannot start. When this process is stopped by a signal, the same signal goes
// to the child before the scope closes.
export function runCommand(name: CommandName, args: ReadonlyArray<string>) {
  return Effect.scoped(
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const command = yield* commandFor(name, args)
      const handle = yield* spawner.spawn(command).pipe(
        Effect.mapError(
          (err) =>
            new CliError({
              message: `webular: failed to start ${name} (${errMsg(err)})`,
              exitCode: EXIT.toolchainMissing,
            }),
        ),
      )
      return yield* exitOf(handle).pipe(
        Effect.onInterrupt(() =>
          handle
            .kill({ killSignal: receivedSignal(), forceKillAfter: '5 seconds' })
            .pipe(Effect.ignore),
        ),
      )
    }),
  )
}
