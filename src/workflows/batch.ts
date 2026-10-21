// BATCH workflow: scrape many targets concurrently with a bounded
// Effect.forEach. Results keep input order, never completion order; sub-runs
// get deterministic runIds (the target URL).
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { Effect } from 'effect'
import { z } from 'zod'
import { hostConcurrency } from '../core/budget.ts'
import { errMsg } from '../core/output.ts'
import { stepRuntime } from './runtime.ts'
import { scrapeWorkflow } from './scrape.ts'

const batchInput = z.object({
  urls: z.array(z.url()).max(1000),
  // Unset means host-sized (core/budget.ts).
  concurrency: z.number().int().positive().max(32).optional(),
  timeoutMs: z.number().int().positive().optional(),
  // Dead page → Wayback raw capture, as `scrape --archive` does for each URL.
  archive: z.boolean().optional(),
})

const resultItem = z.object({
  url: z.string(),
  ok: z.boolean(),
  title: z.string().optional(),
  error: z.string().optional(),
})

const batchOutput = z.object({
  count: z.number(),
  results: z.array(resultItem),
})

type ResultItem = z.infer<typeof resultItem>

// Index-prefixed runId: deterministic AND unique — Mastra caches Run
// instances by id, so duplicate target URLs must not share one.
const scrapeRun = (url: string, index: number, timeoutMs?: number, archive?: boolean) =>
  Effect.tryPromise(() => scrapeWorkflow.createRun({ runId: `${index}:${url}` })).pipe(
    Effect.flatMap((run) =>
      Effect.tryPromise(() => run.start({ inputData: { url, timeoutMs, archive } })),
    ),
  )

const scrapeOne = (
  url: string,
  index: number,
  timeoutMs?: number,
  archive?: boolean,
): Effect.Effect<ResultItem> =>
  Effect.match(scrapeRun(url, index, timeoutMs, archive), {
    onFailure: (err): ResultItem => ({ url, ok: false, error: errMsg(err.cause ?? err) }),
    onSuccess: (outcome): ResultItem => {
      if (outcome.status === 'success') return { url, ok: true, title: outcome.result.title }
      const detail = outcome.status === 'failed' ? outcome.error.message : outcome.status
      return { url, ok: false, error: detail }
    },
  })

const runBatchStep = createStep({
  id: 'run-batch',
  inputSchema: batchInput,
  outputSchema: batchOutput,
  execute: ({ inputData }) =>
    stepRuntime.runPromise(
      Effect.gen(function* () {
        const concurrency = inputData.concurrency ?? (yield* hostConcurrency)
        const results = yield* Effect.forEach(
          inputData.urls,
          (url, index) => scrapeOne(url, index, inputData.timeoutMs, inputData.archive),
          { concurrency },
        )
        return { count: results.length, results }
      }),
    ),
})

export const batchWorkflow = createWorkflow({
  id: 'batch',
  inputSchema: batchInput,
  outputSchema: batchOutput,
})
  .then(runBatchStep)
  .commit()
