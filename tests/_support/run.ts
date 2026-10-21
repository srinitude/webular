// Bun's runner has no Effect adapter: one place runs a test body as an Effect.
// Scoped, so a body may acquire fixtures that release when the test ends, and
// given the Bun platform services (FileSystem, Path, ChildProcessSpawner) and
// a Readability worker pool that closes with the test, as stepRuntime gives.
import * as BunServices from '@effect/platform-bun/BunServices'
import { Effect, FileSystem, Layer, type Scope } from 'effect'
import { ParsePool } from '../../src/lib/sources.ts'

const testLayer = Layer.mergeAll(BunServices.layer, ParsePool.layer)

export const eff =
  <A, E>(body: Effect.Effect<A, E, Scope.Scope | BunServices.BunServices | ParsePool>) =>
  () =>
    Effect.runPromise(Effect.provide(Effect.scoped(body), testLayer))

// A Promise-returning API (Bun, node:fs/promises, Mastra) as an Effect.
export const io = <A>(run: () => Promise<A>) =>
  Effect.tryPromise({ try: run, catch: (e) => (e instanceof Error ? e : new Error(String(e))) })

// The failure of an Effect as a message, for asserting on expected errors.
export const failMsg = <A, E, R>(body: Effect.Effect<A, E, R>) =>
  Effect.flip(body).pipe(Effect.map((e) => (e instanceof Error ? e.message : String(e))))

// A temp directory removed when the enclosing scope closes.
export const tmpDir = (prefix: string) =>
  Effect.flatMap(FileSystem.FileSystem, (fs) => fs.makeTempDirectoryScoped({ prefix }))
