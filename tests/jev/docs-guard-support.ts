// Shared docs-guard test helpers: the recorded docs, a registered model, and payload builders.
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem } from 'effect'
import { DECISION_MODELS } from '../../src/lib/jev/docs-snapshot.ts'

export const root = `${import.meta.dir}/../..`
export const runFs = <A, E>(e: Effect.Effect<A, E, FileSystem.FileSystem>) =>
  Effect.runPromise(e.pipe(Effect.provide(BunServices.layer)))
export const docs = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  return yield* fs.readFileString(`${root}/tests/fixtures/jev-docs/llms-full.txt`)
})
export const jev = DECISION_MODELS[0] as (typeof DECISION_MODELS)[number]
export const req = (questions: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  model: 'jev-latest',
  state: { x: 'a' },
  questions,
  ...extra,
})
export const noul = { q: { type: 'noul', instructions: 'Is `x` set?' } }
