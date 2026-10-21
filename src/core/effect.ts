// The one Effect edge for every process entry: a typed CLI failure carries
// its own message and exit code, and runMain maps each failure to both.
import { runMain as bunRunMain } from '@effect/platform-bun/BunRuntime'
import * as BunServices from '@effect/platform-bun/BunServices'
import { Cause, Data, Effect, Exit, type Runtime } from 'effect'
import { errMsg } from './output.ts'

export class CliError extends Data.TaggedError('CliError')<{
  readonly message: string
  readonly exitCode: number
}> {}

function failureOf(cause: Cause.Cause<unknown>): { message: string; exitCode: number } {
  if (Cause.hasInterruptsOnly(cause)) return { message: '', exitCode: 130 }
  const err = Cause.squash(cause)
  if (err instanceof CliError) return { message: err.message, exitCode: err.exitCode }
  return { message: errMsg(err), exitCode: 1 }
}

// The teardown runs outside any fiber, so it writes stderr directly.
const teardown: Runtime.Teardown = (exit, onExit) => {
  if (Exit.isSuccess(exit)) return onExit(Number(exit.value ?? 0))
  const { message, exitCode } = failureOf(exit.cause)
  if (message !== '') process.stderr.write(`${message}\n`)
  onExit(exitCode)
}

// Runs a program that yields its exit code with the Bun platform services
// (FileSystem, Path, ChildProcessSpawner). BunRuntime.runMain ends the process
// on any non-zero code, so an open handle never holds a failed command alive.
export function runMain(program: Effect.Effect<number, unknown, BunServices.BunServices>): void {
  bunRunMain(Effect.provide(program, BunServices.layer), { disableErrorReporting: true, teardown })
}
