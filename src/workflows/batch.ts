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
  // Only web URLs: a bare z.url() also takes file:, javascript:, and data:.
  urls: z.array(z.url({ protocol: /^https?$/ })).max(1000),
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
  // robots.txt disallows this URL; batch has no override, so it was never fetched.
  status: z.literal('blocked').optional(),
  reason: z.literal('robots').optional(),
})

const batchOutput = z.object({
  count: z.number(),
  results: z.array(resultItem),
})

type ResultItem = z.infer<typeof resultItem>

const ROBOTS_BLOCKED = 'blocked: robots.txt disallows this URL'

// Index-prefixed runId: deterministic AND unique — Mastra caches Run
// instances by id; targets are deduped first, so the index is per distinct URL.
const scrapeRun = (url: string, index: number, timeoutMs?: number, archive?: boolean) =>
  Effect.tryPromise(() => scrapeWorkflow.createRun({ runId: `${index}:${url}` })).pipe(
    Effect.flatMap((run) =>
      Effect.tryPromise(() => run.start({ inputData: { url, timeoutMs, archive } })).pipe(
        // Interrupting the batch step must also stop the nested scrape run.
        Effect.onInterrupt(() => Effect.promise(() => run.cancel())),
      ),
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
      if (outcome.status === 'success' && outcome.result.status === 'blocked')
        return { url, ok: false, status: 'blocked', reason: 'robots', error: ROBOTS_BLOCKED }
      if (outcome.status === 'success') return { url, ok: true, title: outcome.result.title }
      const detail = outcome.status === 'failed' ? outcome.error.message : outcome.status
      return { url, ok: false, error: detail }
    },
  })

// Each distinct URL is fetched once; every input slot, duplicates included,
// gets its URL's result, in input order.
const spreadToInputs = (urls: string[], unique: string[], fetched: ResultItem[]) => {
  const byUrl = new Map(unique.map((url, i) => [url, fetched[i] as ResultItem]))
  return urls.map((url) => byUrl.get(url) as ResultItem)
}

const runBatchStep = createStep({
  id: 'run-batch',
  inputSchema: batchInput,
  outputSchema: batchOutput,
  execute: ({ inputData, abortSignal }) =>
    stepRuntime.runPromise(
      Effect.gen(function* () {
        const concurrency = inputData.concurrency ?? (yield* hostConcurrency)
        const unique = [...new Set(inputData.urls)]
        const fetched = yield* Effect.forEach(
          unique,
          (url, index) => scrapeOne(url, index, inputData.timeoutMs, inputData.archive),
          { concurrency },
        )
        const results = spreadToInputs(inputData.urls, unique, fetched)
        return { count: results.length, results }
      }),
      { signal: abortSignal },
    ),
})

export const batchWorkflow = createWorkflow({
  id: 'batch',
  inputSchema: batchInput,
  outputSchema: batchOutput,
  options: { shouldPersistSnapshot: () => false },
})
  .then(runBatchStep)
  .commit()
