// BATCH workflow: run an operation (e.g. scrape) over many targets concurrently
// using p-limit. Returns an aggregated result with per-URL outcomes.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import pLimit from 'p-limit'
import { z } from 'zod'
import { scrapeWorkflow } from './scrape.ts'

export const batchInput = z.object({
  op: z.enum(['scrape']).default('scrape'),
  urls: z.array(z.string().url()).max(1000),
  concurrency: z.number().int().positive().max(32).default(4),
})

const resultItem = z.object({
  url: z.string(),
  ok: z.boolean(),
  title: z.string().optional(),
  error: z.string().optional(),
})

export const batchOutput = z.object({
  op: z.string(),
  count: z.number(),
  results: z.array(resultItem),
})

async function scrapeOne(url: string): Promise<z.infer<typeof resultItem>> {
  try {
    const run = await scrapeWorkflow.createRun({ runId: crypto.randomUUID() })
    const outcome = (await run.start({ inputData: { url } })) as {
      status: string
      result?: { title?: string }
      error?: unknown
    }
    if (outcome.status !== 'success') {
      return { url, ok: false, error: String(outcome.error ?? outcome.status) }
    }
    return { url, ok: true, title: outcome.result?.title }
  } catch (err) {
    return { url, ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

const runBatchStep = createStep({
  id: 'run-batch',
  inputSchema: batchInput,
  outputSchema: batchOutput,
  execute: async ({ inputData }) => {
    const limit = pLimit(inputData.concurrency)
    const results = await Promise.all(inputData.urls.map((url) => limit(() => scrapeOne(url))))
    return { op: inputData.op, count: results.length, results }
  },
})

export const batchWorkflow = createWorkflow({
  id: 'batch',
  inputSchema: batchInput,
  outputSchema: batchOutput,
})
  .then(runBatchStep)
  .commit()
