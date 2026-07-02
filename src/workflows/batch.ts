// BATCH workflow: scrape many targets concurrently using p-limit. Results
// collect by Promise.all index (input order), never completion order; sub-runs
// get deterministic runIds (the target URL).
import { createStep, createWorkflow } from '@mastra/core/workflows'
import pLimit from 'p-limit'
import { z } from 'zod'
import { errMsg } from '../core/output.ts'
import { scrapeWorkflow } from './scrape.ts'

const batchInput = z.object({
  urls: z.array(z.string().url()).max(1000),
  concurrency: z.number().int().positive().max(32).default(4),
  timeoutMs: z.number().int().positive().optional(),
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

async function scrapeOne(
  url: string,
  index: number,
  timeoutMs?: number,
): Promise<z.infer<typeof resultItem>> {
  try {
    // Index-prefixed runId: deterministic AND unique — Mastra caches Run
    // instances by id, so duplicate target URLs must not share one.
    const run = await scrapeWorkflow.createRun({ runId: `${index}:${url}` })
    const outcome = await run.start({ inputData: { url, timeoutMs } })
    if (outcome.status !== 'success') {
      const detail = outcome.status === 'failed' ? outcome.error.message : outcome.status
      return { url, ok: false, error: detail }
    }
    return { url, ok: true, title: outcome.result.title }
  } catch (err) {
    return { url, ok: false, error: errMsg(err) }
  }
}

const runBatchStep = createStep({
  id: 'run-batch',
  inputSchema: batchInput,
  outputSchema: batchOutput,
  execute: async ({ inputData }) => {
    const limit = pLimit(inputData.concurrency)
    const results = await Promise.all(
      inputData.urls.map((url, index) => limit(() => scrapeOne(url, index, inputData.timeoutMs))),
    )
    return { count: results.length, results }
  },
})

export const batchWorkflow = createWorkflow({
  id: 'batch',
  inputSchema: batchInput,
  outputSchema: batchOutput,
})
  .then(runBatchStep)
  .commit()
