// Provider keys: the environment first (through Config), then the macOS
// Keychain by item name. Values stay in memory and are never printed.
import { Config, Effect, Option, Redacted } from 'effect'
import { ChildProcess, ChildProcessSpawner } from 'effect/process'

const keychain = (item: string) =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const lines = yield* spawner.lines(
      ChildProcess.make('security', ['find-generic-password', '-s', item, '-w']),
    )
    return lines.join('').trim() || undefined
  }).pipe(Effect.orElseSucceed(() => undefined))

export const readKey = (env: string, item?: string) =>
  Effect.gen(function* () {
    const fromEnv = yield* Config.option(Config.Redacted(env))
    if (Option.isSome(fromEnv)) return Redacted.value(fromEnv.value)
    return item && process.platform === 'darwin' ? yield* keychain(item) : undefined
  }).pipe(Effect.orElseSucceed(() => undefined))
