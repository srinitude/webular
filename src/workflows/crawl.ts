// CRAWL workflow: BFS over same-host pages, non-model, FOSS only.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { bfsCrawl } from '../lib/crawl.ts'
import { fetchErrorsSchema } from '../lib/sources.ts'

const crawlInput = z.object({
  url: z.string().url(),
  limit: z.number().int().min(1).max(1000).default(5),
  depth: z.number().int().min(0).max(10).default(2),
  concurrency: z.number().int().min(1).max(32).default(4),
  timeoutMs: z.number().int().positive().optional(),
})

const pageSchema = z.object({ url: z.string(), title: z.string() })

const crawlOutput = z.object({
  root: z.string(),
  count: z.number(),
  pages: z.array(pageSchema),
  errors: fetchErrorsSchema,
})

const crawlStep = createStep({
  id: 'crawl',
  inputSchema: crawlInput,
  outputSchema: crawlOutput,
  execute: async ({ inputData }) => {
    const { root, pages, errors } = await bfsCrawl(inputData.url, {
      limit: inputData.limit,
      depth: inputData.depth,
      concurrency: inputData.concurrency,
      timeoutMs: inputData.timeoutMs,
    })
    return { root, count: pages.length, pages, errors }
  },
})

export const crawlWorkflow = createWorkflow({
  id: 'crawl',
  inputSchema: crawlInput,
  outputSchema: crawlOutput,
})
  .then(crawlStep)
  .commit()
