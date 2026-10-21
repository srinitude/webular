// SEARCH workflow: keyless web search (DuckDuckGo HTML endpoint via fetch) or a
// specialized keyless source (--source wikipedia|hackernews|arxiv|crossref|
// openalex). The default web source falls back through the others in order;
// `source` names the one that answered.
// composed as a Mastra non-model workflow over the FOSS search lib.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { searchWithSource } from '../lib/search-chain.ts'
import { SEARCH_SOURCES } from '../lib/sources-search.ts'

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
  source: z.enum(SEARCH_SOURCES).optional(),
  results: z.array(resultItem),
})

const searchStep = createStep({
  id: 'search',
  inputSchema: searchInput,
  outputSchema: searchOutput,
  execute: async ({ inputData }) => {
    const { query, limit, source } = inputData
    const { source: answered, results } = await searchWithSource(source, query, limit)
    return { query, count: results.length, ...(answered && { source: answered }), results }
  },
})

export const searchWorkflow = createWorkflow({
  id: 'search',
  inputSchema: searchInput,
  outputSchema: searchOutput,
})
  .then(searchStep)
  .commit()
