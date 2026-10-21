// Effect-native repo readers for the best-practices checks
// (docs/best-practices.md). Every read is typed; JSON goes through Schema.

import { afterAll, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, ManagedRuntime, Schema } from 'effect'
import { ROOT } from './root.ts'

const Strings = Schema.Record(Schema.String, Schema.String)

const PackageJson = Schema.fromJsonString(
  Schema.Struct({
    version: Schema.String,
    files: Schema.Array(Schema.String),
    engines: Strings,
    dependencies: Strings,
    devDependencies: Strings,
  }),
)

const TsConfig = Schema.fromJsonString(
  Schema.Struct({ compilerOptions: Schema.Record(Schema.String, Schema.Unknown) }),
)

export const read = Effect.fn('read')(function* (path: string) {
  const fs = yield* FileSystem.FileSystem
  return yield* fs.readFileString(`${ROOT}${path}`)
})

export const exists = Effect.fn('exists')(function* (path: string) {
  const fs = yield* FileSystem.FileSystem
  return yield* fs.exists(`${ROOT}${path}`)
})

export const packageJson = Effect.flatMap(
  read('package.json'),
  Schema.decodeUnknownEffect(PackageJson),
)

export const tsconfig = Effect.flatMap(read('tsconfig.json'), Schema.decodeUnknownEffect(TsConfig))

const tsFiles = Effect.fn('tsFiles')(function* (dir: string) {
  const fs = yield* FileSystem.FileSystem
  const entries = yield* fs.readDirectory(`${ROOT}${dir}`, { recursive: true })
  return entries.filter((file) => file.endsWith('.ts')).map((file) => `${dir}/${file}`)
})

// Sorted list of src/ and bin/ files whose text matches the pattern.
export const matching = Effect.fn('matching')(function* (pattern: RegExp) {
  const files = [...(yield* tsFiles('src')), ...(yield* tsFiles('bin'))]
  const texts = yield* Effect.forEach(files, read, { concurrency: 8 })
  return files.filter((_, index) => pattern.test(texts[index] ?? '')).sort()
})

// Each test file calls this once: it owns one runtime, disposed after its
// tests, and gets back `check`, a bun test whose body is an Effect.
export const fileChecks = () => {
  const runtime = ManagedRuntime.make(BunServices.layer)
  afterAll(() => runtime.dispose())
  return <E>(name: string, body: Effect.Effect<void, E, FileSystem.FileSystem>) =>
    test(name, () => runtime.runPromise(body))
}
