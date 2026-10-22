// When every search source fails, answer and research report each failed source
// in `errors` (so the command exits 1) instead of an empty success.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { answerWorkflow } from '../../src/workflows/answer.ts'
import { researchWorkflow } from '../../src/workflows/research.ts'
import { eff } from '../_support/run.ts'

// A closed port: every free source and DuckDuckGo fail at once, with no network.
const deadSources = Effect.sync(() =>
  Object.assign(process.env, {
    WEBULAR_SOURCE_ORIGIN: 'http://127.0.0.1:1',
    WEBULAR_SOURCE_GAP_MS: '0',
    WEBULAR_JEV: 'off',
  }),
)

test(
  'answer reports failed search sources when nothing was found',
  eff(
    Effect.gen(function* () {
      yield* deadSources
      const run = yield* Effect.promise(() => answerWorkflow.createRun({ runId: 'dead-answer' }))
      const out = yield* Effect.promise(() =>
        run.start({ inputData: { query: 'zxqv unlikely topic', sources: 3, sentences: 3 } }),
      )
      if (out.status !== 'success') return yield* Effect.die(`run ${out.status}`)
      expect(out.result.errors.length).toBeGreaterThan(0)
    }),
  ),
  60_000,
)

test(
  'research reports failed search sources when nothing was found',
  eff(
    Effect.gen(function* () {
      yield* deadSources
      const run = yield* Effect.promise(() =>
        researchWorkflow.createRun({ runId: 'dead-research' }),
      )
      const out = yield* Effect.promise(() =>
        run.start({ inputData: { topic: 'zxqv unlikely topic', depth: 3, sentences: 2 } }),
      )
      if (out.status !== 'success') return yield* Effect.die(`run ${out.status}`)
      expect(out.result.errors.length).toBeGreaterThan(0)
    }),
  ),
  60_000,
)
