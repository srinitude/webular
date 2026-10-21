// The one Effect edge for every process entry: a typed CLI failure carries
// its own message and exit code, and runMain maps each failure to both.
import { runMain as bunRunMain } from '@effect/platform-bun/BunRuntime'
import * as BunServices from '@effect/platform-bun/BunServices'
import { Cause, Data, Effect, Exit, Match, type Runtime } from 'effect'
import { errMsg } from './output.ts'
import type { ProcError } from './proc.ts'

export class CliError extends Data.TaggedError('CliError')<{
  readonly message: string
  readonly exitCode: number
}> {}

// Each tagged error maps to a README exit code: a CliError carries its own
// (2 = usage), a ProcError means the child could not run (127 = toolchain
// missing); any other failure is 1.
export const failureOf = (err: unknown): { message: string; exitCode: number } =>
  Match.value(err as CliError | ProcError | { readonly _tag?: undefined }).pipe(
    Match.tag('CliError', (e) => ({ message: e.message, exitCode: e.exitCode })),
    Match.tag('ProcError', (e) => ({ message: e.message, exitCode: 127 })),
    Match.orElse((e) => ({ message: errMsg(e), exitCode: 1 })),
  )

const failureOfCause = (cause: Cause.Cause<unknown>): { message: string; exitCode: number } =>
  Cause.hasInterruptsOnly(cause) ? { message: '', exitCode: 130 } : failureOf(Cause.squash(cause))

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
  bunRunMain(Effect.provide(program, BunServices.layer), { disableErrorReporting: true, teardown })
}
