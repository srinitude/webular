// Removes build output on every OS: the Windows task shell has no `rm -rf`.
import { BunFileSystem, BunRuntime } from '@effect/platform-bun'
import { Effect, FileSystem } from 'effect'

const clean = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  yield* fs.remove('dist', { recursive: true, force: true })
})

BunRuntime.runMain(clean.pipe(Effect.provide(BunFileSystem.layer)))
