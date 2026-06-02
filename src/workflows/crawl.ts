// CRAWL workflow: BFS over same-host pages, non-model, FOSS only.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { bfsCrawl } from '../lib/crawl.ts'

export const crawlInput = z.object({
  url: z.string().url(),
  limit: z.number().int().min(1).default(5),
  depth: z.number().int().min(0).default(2),
  concurrency: z.number().int().min(1).default(4),
})

export const pageSchema = z.object({ url: z.string(), title: z.string() })

export const crawlOutput = z.object({
  root: z.string(),
  count: z.number(),
  pages: z.array(pageSchema),
})

const crawlStep = createStep({
  id: 'crawl',
  inputSchema: crawlInput,
  outputSchema: crawlOutput,
  execute: async ({ inputData }) => {
    const pages = await bfsCrawl(inputData.url, {
      limit: inputData.limit,
      depth: inputData.depth,
      concurrency: inputData.concurrency,
    })
    return { root: inputData.url, count: pages.length, pages }
  },
})

export const crawlWorkflow = createWorkflow({
  id: 'crawl',
  inputSchema: crawlInput,
  outputSchema: crawlOutput,
})
  .then(crawlStep)
  .commit()
