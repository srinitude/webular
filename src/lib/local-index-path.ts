// Where the local index lives, plus the error type shared by every local-index file.
import { BunServices } from '@effect/platform-bun'
import { Config, ConfigProvider, Data, Effect, FileSystem, Path } from 'effect'

export class LocalIndexError extends Data.TaggedError('LocalIndexError')<{
  readonly cause: unknown
}> {}

/** WEBULAR_CACHE_DIR/local-index.sqlite (default ~/.cache/webular); in memory when WEBULAR_NO_CACHE=1. */
export const localIndexPath = Effect.gen(function* () {
  const off = yield* Config.String('WEBULAR_NO_CACHE').pipe(Config.withDefault(''))
  if (off === '1') return ':memory:'
  const path = yield* Path.Path
  const home = yield* Config.String('HOME').pipe(Config.withDefault('.'))
  const dir = yield* Config.String('WEBULAR_CACHE_DIR').pipe(
    Config.withDefault(path.join(home, '.cache', 'webular')),
  )
  const fs = yield* FileSystem.FileSystem
  yield* fs.makeDirectory(dir, { recursive: true })
  return path.join(dir, 'local-index.sqlite')
}).pipe(
  // A fresh env snapshot per call: the runtime's default provider copies process.env once.
  Effect.provideServiceEffect(
    ConfigProvider.ConfigProvider,
    Effect.sync(() => ConfigProvider.fromEnv()),
  ),
  Effect.provide(BunServices.layer),
  Effect.mapError((cause) => new LocalIndexError({ cause })),
)
