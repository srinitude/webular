// Stand-in cua-driver for cua-session-leak.effect.test.ts: appends the tool name
// (second argument) to the file named by FAKE_CUA_LOG, fails get_browser_state,
// and prints an empty JSON object for every other tool.
import { BunRuntime } from '@effect/platform-bun'
import * as BunServices from '@effect/platform-bun/BunServices'
import { Config, Console, Effect, FileSystem } from 'effect'

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const log = yield* Config.String('FAKE_CUA_LOG')
  const tool = process.argv[3] ?? ''
  yield* fs.writeFileString(log, `${tool}\n`, { flag: 'a' })
  if (tool === 'get_browser_state') return yield* Effect.fail('get_browser_state fails on purpose')
  yield* Console.log('{}')
})

BunRuntime.runMain(program.pipe(Effect.provide(BunServices.layer)))
