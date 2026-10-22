// Where the local index lives, plus the error type shared by every local-index file.
import { BunServices } from '@effect/platform-bun'
import { Config, ConfigProvider, Context, Data, Effect, FileSystem, Path } from 'effect'

export class LocalIndexError extends Data.TaggedError('LocalIndexError')<{
  readonly cause: unknown
}> {}

/** WEBULAR_CACHE_DIR/local-index.sqlite (default ~/.cache/webular); in memory when WEBULAR_NO_CACHE=1. */
export const localIndexPath = Effect.gen(function* () {
  const off = yield* Config.String('WEBULAR_NO_CACHE').pipe(Config.withDefault(''))
  if (off === '1') return ':memory:'
  const path = yield* Path.Path
  const home = yield* Config.String('HOME').pipe(
    Config.orElse(() => Config.String('USERPROFILE')),
    Config.withDefault('.'),
  )
  const dir = yield* Config.String('WEBULAR_CACHE_DIR').pipe(
    Config.withDefault(path.join(home, '.cache', 'webular')),
  )
  const fs = yield* FileSystem.FileSystem
  yield* fs.makeDirectory(dir, { recursive: true })
  return path.join(dir, 'local-index.sqlite')
}).pipe(
  // A caller-supplied provider wins. Otherwise take a fresh env snapshot per call:
  // the default provider (the Reference's cached value) copies process.env once.
  Effect.provideServiceEffect(
    ConfigProvider.ConfigProvider,
    Effect.gen(function* () {
      const p = yield* ConfigProvider.ConfigProvider
      const fallback = Context.getUnsafe(Context.empty(), ConfigProvider.ConfigProvider)
      return p === fallback ? ConfigProvider.fromEnv() : p
    }),
  ),
  Effect.provide(BunServices.layer),
  Effect.mapError((cause) => new LocalIndexError({ cause })),
)
