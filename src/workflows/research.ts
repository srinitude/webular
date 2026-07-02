// RESEARCH workflow: search DDG HTML → fetch top N → extract + summarize → markdown report
// Composed as a Mastra non-model workflow over FOSS tools.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { webSearch } from '../lib/search.ts'
import { fetchErrorsSchema, fetchSources, type SourceEntry } from '../lib/sources.ts'
import { summarizeText } from '../lib/summarize.ts'

const researchInput = z.object({
  topic: z.string().min(1),
  depth: z.number().int().min(1).max(10).default(3),
  sentences: z.number().int().min(1).max(25).default(2),
  timeoutMs: z.number().int().positive().optional(),
})

const sourceItem = z.object({ title: z.string(), url: z.string() })

const researchOutput = z.object({
  topic: z.string(),
  report: z.string(),
  sources: z.array(sourceItem),
  errors: fetchErrorsSchema,
})

const foundSchema = z.object({
  topic: z.string(),
  sentences: z.number(),
  timeoutMs: z.number().optional(),
  sources: z.array(sourceItem),
})

const entriesSchema = z.object({
  topic: z.string(),
  sentences: z.number(),
  entries: z.array(z.object({ title: z.string(), url: z.string(), text: z.string() })),
  errors: fetchErrorsSchema,
})

const searchStep = createStep({
  id: 'search',
  inputSchema: researchInput,
  outputSchema: foundSchema,
  execute: async ({ inputData }) => {
    const found = await webSearch(inputData.topic, inputData.depth)
    return {
      topic: inputData.topic,
      sentences: inputData.sentences,
      timeoutMs: inputData.timeoutMs,
      sources: found.map((h) => ({ title: h.title, url: h.url })),
    }
  },
})

const fetchSourcesStep = createStep({
  id: 'fetch-sources',
  inputSchema: foundSchema,
  outputSchema: entriesSchema,
  execute: async ({ inputData }) => {
    const fetched = await fetchSources(inputData.sources, inputData.timeoutMs)
    return {
      topic: inputData.topic,
      sentences: inputData.sentences,
      entries: fetched.entries,
      errors: fetched.errors,
    }
  },
})

function buildSection(entry: SourceEntry, idx: number, topN: number): string {
  const { sentences } = summarizeText(entry.text, topN)
  const body = sentences.length > 0 ? sentences.join(' ') : 'No extractable content.'
  return `## ${entry.title || `Source ${idx + 1}`}\n\n${body}\n\n> Source [${idx + 1}]: ${entry.url}`
}

const assembleStep = createStep({
  id: 'assemble',
  inputSchema: entriesSchema,
  outputSchema: researchOutput,
  execute: async ({ inputData }) => {
    const sections = inputData.entries.map((e, i) => buildSection(e, i, inputData.sentences))
    const report = `# Research: ${inputData.topic}\n\n${sections.join('\n\n')}`
    const sources = inputData.entries.map((e) => ({ title: e.title, url: e.url }))
    return { topic: inputData.topic, report, sources, errors: inputData.errors }
  },
})

export const researchWorkflow = createWorkflow({
  id: 'research',
  inputSchema: researchInput,
  outputSchema: researchOutput,
})
  .then(searchStep)
  .then(fetchSourcesStep)
  .then(assembleStep)
  .commit()
