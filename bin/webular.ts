#!/usr/bin/env bun
// webular CLI entrypoint. Thin by design: run the native build for this
// machine when one is installed, else parse argv, route to mise, exit.
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Effect, Option } from 'effect'
import { bunEntryEnv, launchNative } from '../src/cli/launch.ts'
import { route } from '../src/cli/route.ts'

const argv = Bun.argv.slice(2)

const main = Effect.gen(function* () {
  const native = yield* launchNative(argv)
  if (Option.isSome(native)) return native.value
  const extraEnv = yield* bunEntryEnv
  return yield* Effect.promise(() => route(argv, extraEnv))
})

BunRuntime.runMain(
  main.pipe(
    Effect.flatMap((code) => Effect.sync(() => process.exit(code))),
    Effect.provide(BunServices.layer),
  ),
)
