#!/usr/bin/env bun
// webular CLI entrypoint. Thin by design: run the native build for this
// machine when one is installed, else parse argv, start the command, exit.
import { Effect, Option } from 'effect'
import { launchNative } from '../src/cli/launch.ts'
import { route } from '../src/cli/route.ts'
import { runMain } from '../src/core/effect.ts'

const argv = Bun.argv.slice(2)

runMain(
  Effect.gen(function* () {
    const native = yield* launchNative(argv)
    if (Option.isSome(native)) return native.value
    return yield* route(argv)
  }),
)
