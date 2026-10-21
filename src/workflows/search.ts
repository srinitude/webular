// SEARCH workflow: keyless web search (DuckDuckGo HTML endpoint via fetch) or a
// specialized keyless source (--source wikipedia|hackernews|arxiv),
// composed as a Mastra non-model workflow over the FOSS search lib.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { webSearch } from '../lib/search.ts'
import { SEARCH_SOURCES, sourceSearch } from '../lib/sources-search.ts'

const searchInput = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().default(10),
  source: z.enum(SEARCH_SOURCES).default('web'),
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
    const { query, limit, source } = inputData
    const results =
      source === 'web' ? await webSearch(query, limit) : await sourceSearch(source, query, limit)
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
