// Refreshes the setup freshness stamp on every OS: the Windows task shell has no `touch`.
import { BunFileSystem, BunRuntime } from '@effect/platform-bun'
import { Effect, FileSystem } from 'effect'

const stamp = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  yield* fs.writeFileString('node_modules/.webular-setup', '')
})

BunRuntime.runMain(stamp.pipe(Effect.provide(BunFileSystem.layer)))
