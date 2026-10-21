// The one Effect edge for every process entry: a typed CLI failure carries
// its own message and exit code, and runMain maps each failure to both.
import { constants } from 'node:os'
import { runMain as bunRunMain } from '@effect/platform-bun/BunRuntime'
import * as BunServices from '@effect/platform-bun/BunServices'
import { Cause, Data, Effect, Exit, Match, type Runtime } from 'effect'
import { EXIT } from '../cli/exit-codes.ts'
import { errMsg } from './output.ts'
import type { ProcError } from './proc.ts'

export class CliError extends Data.TaggedError('CliError')<{
  readonly message: string
  readonly exitCode: number
}> {}

type StopSignal = 'SIGINT' | 'SIGTERM'

// The signal that stopped this process, so a parent can forward that exact
// signal to its child and both exit 128 + its number (SIGTERM 143, not 130).
const stop: { signal: StopSignal | undefined } = { signal: undefined }
export const receivedSignal = (): StopSignal => stop.signal ?? 'SIGTERM'

export const signalExit = (signal: string): number =>
  128 + (constants.signals[signal as NodeJS.Signals] ?? 0)

// BunRuntime.runMain interrupts the main fiber on SIGINT and SIGTERM without
// saying which; this listener records it for the teardown.
const recordSignals = Effect.acquireRelease(
  Effect.sync(() => {
    const onSignal = (signal: StopSignal) => {
      stop.signal = signal
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
    ? { message: '', exitCode: signalExit(stop.signal ?? 'SIGINT') }
    : failureOf(Cause.squash(cause))

// The teardown runs outside any fiber, so it writes stderr directly.
const teardown: Runtime.Teardown = (exit, onExit) => {
  if (Exit.isSuccess(exit)) return onExit(Number(exit.value ?? 0))
  const { message, exitCode } = failureOfCause(exit.cause)
  if (message !== '') process.stderr.write(`${message}\n`)
  onExit(exitCode)
}

// Runs a program that yields its exit code with the Bun platform services
// (FileSystem, Path, ChildProcessSpawner). BunRuntime.runMain ends the process
// on any non-zero code, so an open handle never holds a failed command alive.
export function runMain(program: Effect.Effect<number, unknown, BunServices.BunServices>): void {
  const main = Effect.scoped(Effect.andThen(recordSignals, program))
  bunRunMain(Effect.provide(main, BunServices.layer), { disableErrorReporting: true, teardown })
}
