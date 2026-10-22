// Child entry for cua-session-leak.effect.test.ts: one cua render, run in its own
// process so the test can put a fake cua-driver first on this PATH.
import { BunRuntime } from '@effect/platform-bun'
import { Cause, Console, Effect, Exit } from 'effect'
import { Driver } from '../../src/lib/driver.ts'
import { CuaLive } from '../../src/lib/driver-cua.ts'

BunRuntime.runMain(
  Driver.use((driver) => Effect.exit(driver.render('https://example.com/'))).pipe(
    Effect.flatMap((exit) =>
      Effect.andThen(
        Exit.isFailure(exit) ? Console.error(Cause.pretty(exit.cause)) : Effect.void,
        Console.log(exit._tag),
      ),
    ),
    Effect.provide(CuaLive),
  ),
)
