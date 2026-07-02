// SEARCH workflow: keyless web search (DuckDuckGo HTML endpoint via fetch),
// composed as a Mastra non-model workflow over the FOSS search lib.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { webSearch } from '../lib/search.ts'

const searchInput = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().default(10),
})

const resultItem = z.object({
  title: z.string(),
  url: z.string(),
  description: z.string(),
})

const searchOutput = z.object({
  query: z.string(),
  count: z.number(),
  results: z.array(resultItem),
})

const searchStep = createStep({
  id: 'search',
  inputSchema: searchInput,
  outputSchema: searchOutput,
  execute: async ({ inputData }) => {
    const results = await webSearch(inputData.query, inputData.limit)
    return { query: inputData.query, count: results.length, results }
  },
})

export const searchWorkflow = createWorkflow({
  id: 'search',
  inputSchema: searchInput,
  outputSchema: searchOutput,
})
  .then(searchStep)
  .commit()
