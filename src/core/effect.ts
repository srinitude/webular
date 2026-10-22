// The one Effect edge for every process entry: a typed CLI failure carries
// its own message and exit code, and runMain maps each failure to both.
import { constants } from 'node:os'
import { basename, extname } from 'node:path'
import { runMain as bunRunMain } from '@effect/platform-bun/BunRuntime'
import * as BunServices from '@effect/platform-bun/BunServices'
import { Cause, Data, Effect, Exit, Match, MutableRef, type Runtime } from 'effect'
import { COMMANDS } from '../cli/commands.ts'
import { EXIT } from '../cli/exit-codes.ts'
import { errorPrefix } from '../cli/style.ts'
import { errMsg } from './output.ts'
import type { ProcError } from './proc.ts'

export class CliError extends Data.TaggedError('CliError')<{
  readonly message: string
  readonly exitCode: number
}> {}

type StopSignal = 'SIGINT' | 'SIGTERM'

// The signal that stopped this process, so a parent can forward that exact
// signal to its child and both exit 128 + its number (SIGTERM 143, not 130).
const stop = MutableRef.make<StopSignal | undefined>(undefined)
export const receivedSignal = Effect.sync((): StopSignal => MutableRef.get(stop) ?? 'SIGTERM')

export const signalExit = (signal: string): number =>
  128 + (constants.signals[signal as NodeJS.Signals] ?? 0)

// BunRuntime.runMain interrupts the main fiber on SIGINT and SIGTERM without
// saying which; this listener records it for the teardown.
const recordSignals = Effect.acquireRelease(
  Effect.sync(() => {
    const onSignal = (signal: StopSignal) => {
      MutableRef.set(stop, signal)
    }
    process.on('SIGINT', onSignal)
    process.on('SIGTERM', onSignal)
    return onSignal
  }),
  (onSignal) =>
    Effect.sync(() => {
      process.removeListener('SIGINT', onSignal)
      process.removeListener('SIGTERM', onSignal)
    }),
)

// Each tagged error maps to a README exit code: a CliError carries its own
// (2 = usage), a ProcError means the child could not run (127 = toolchain
// missing); any other failure is 1.
export const failureOf = (err: unknown): { message: string; exitCode: number } =>
  Match.value(err as CliError | ProcError | { readonly _tag?: undefined }).pipe(
    Match.tag('CliError', (e) => ({ message: e.message, exitCode: e.exitCode })),
    Match.tag('ProcError', (e) => ({ message: e.message, exitCode: EXIT.toolchainMissing })),
    Match.orElse((e) => ({ message: errMsg(e), exitCode: EXIT.failure })),
  )

const failureOfCause = (cause: Cause.Cause<unknown>): { message: string; exitCode: number } =>
  Cause.hasInterruptsOnly(cause)
    ? { message: '', exitCode: signalExit(MutableRef.get(stop) ?? 'SIGINT') }
    : failureOf(Cause.squash(cause))

// The command name is the entry file's stem (src/commands/<name>.ts or
// dist/commands/<name>.js), the same name the CLI dispatched on.
export const commandName = (): string =>
  basename(process.argv[1] ?? '', extname(process.argv[1] ?? ''))

// A usage error (exit 2) always ends by pointing at the help that explains it.
const withHelpHint = (message: string, exitCode: number): string => {
  if (exitCode !== 2 || message === '' || message.includes('--help')) return message
  const cmd = commandName()
  const help = cmd in COMMANDS ? `webular ${cmd} --help` : 'webular --help'
  return `${message}\nRun '${help}' to see how to use it.`
}

// The failure message prints inside the main fiber, before the teardown runs.
const reportFailure = (exit: Exit.Exit<number, unknown>) =>
  Effect.gen(function* () {
    if (Exit.isSuccess(exit)) return
    const { message: raw, exitCode } = failureOfCause(exit.cause)
    const message = withHelpHint(raw, exitCode)
    if (message === '') return
    const prefix = yield* errorPrefix
    yield* Effect.sync(() => process.stderr.write(`${prefix}${message}\n`))
  })

// The teardown runs outside any fiber: it only maps the exit to a code.
const teardown: Runtime.Teardown = (exit, onExit) =>
  onExit(Exit.isSuccess(exit) ? Number(exit.value ?? 0) : failureOfCause(exit.cause).exitCode)

// Runs a program that yields its exit code with the Bun platform services
// (FileSystem, Path, ChildProcessSpawner). BunRuntime.runMain ends the process
// on any non-zero code, so an open handle never holds a failed command alive.
type MainProgram = Effect.Effect<number, unknown, BunServices.BunServices>

// In-process seam for tests: while this global holds a function, runMain hands
// it the program instead of starting and ending the process.
export const IN_PROCESS = Symbol.for('webular.runMain.inProcess')

// The exit code runMain ends with, failure message printed, without the process.
export const exitCodeOf = (program: MainProgram): Effect.Effect<number> =>
  Effect.onExit(
    Effect.provide(Effect.scoped(Effect.andThen(recordSignals, program)), BunServices.layer),
    reportFailure,
  ).pipe(
    Effect.exit,
    Effect.map((exit) =>
      Exit.isSuccess(exit) ? Number(exit.value ?? 0) : failureOfCause(exit.cause).exitCode,
    ),
  )

export function runMain(program: MainProgram): void {
  const seam = (globalThis as { [IN_PROCESS]?: (p: MainProgram) => void })[IN_PROCESS]
  if (seam) {
    seam(program)
    return
  }
  const main = Effect.scoped(Effect.andThen(recordSignals, program))
  bunRunMain(Effect.onExit(Effect.provide(main, BunServices.layer), reportFailure), {
    disableErrorReporting: true,
    teardown,
  })
}
