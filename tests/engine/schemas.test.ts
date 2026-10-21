// Input-bound contracts (P5): out-of-range inputs fail workflow validation
// BEFORE any network is touched — protects MCP/library consumers, not just
// the flag-checked CLI path. Mastra surfaces the zod rejection by throwing
// from run.start; a non-success status counts the same.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { answerWorkflow } from '../../src/workflows/answer.ts'
import { crawlWorkflow } from '../../src/workflows/crawl.ts'
import { mapWorkflow } from '../../src/workflows/map.ts'
import { researchWorkflow } from '../../src/workflows/research.ts'
import { eff, io } from '../_support/run.ts'

const rejected = (start: () => Promise<{ status: string }>) =>
  io(start).pipe(Effect.match({ onFailure: () => true, onSuccess: (r) => r.status !== 'success' }))

describe('workflow input bounds reject before any fetch', () => {
  test(
    'answer caps sources at 10',
    eff(
      Effect.gen(function* () {
        const run = yield* io(() => answerWorkflow.createRun({ runId: 'schema-test' }))
        expect(
          yield* rejected(() =>
            run.start({ inputData: { query: 'q', sources: 99, sentences: 3 } }),
          ),
        ).toBe(true)
      }),
    ),
  )

  test(
    'research caps depth at 10',
    eff(
      Effect.gen(function* () {
        const run = yield* io(() => researchWorkflow.createRun({ runId: 'schema-test' }))
        expect(
          yield* rejected(() => run.start({ inputData: { topic: 't', depth: 99, sentences: 2 } })),
        ).toBe(true)
      }),
    ),
  )

  test(
    'crawl caps limit at 1000',
    eff(
      Effect.gen(function* () {
        const run = yield* io(() => crawlWorkflow.createRun({ runId: 'schema-test' }))
        expect(
          yield* rejected(() =>
            run.start({
              inputData: { url: 'https://example.com', limit: 99_999, depth: 2, concurrency: 4 },
            }),
          ),
        ).toBe(true)
      }),
    ),
  )

  test(
    'map caps limit at 10000',
    eff(
      Effect.gen(function* () {
        const run = yield* io(() => mapWorkflow.createRun({ runId: 'schema-test' }))
        expect(
          yield* rejected(() =>
            run.start({ inputData: { url: 'https://example.com', limit: 999_999 } }),
          ),
        ).toBe(true)
      }),
    ),
  )
})
