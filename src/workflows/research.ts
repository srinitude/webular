// RESEARCH workflow: search DDG HTML → fetch top N → extract + summarize → markdown report
// Composed as a Mastra non-model workflow over FOSS tools.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { fetchText } from '../core/http.ts'
import { htmlToArticle } from '../lib/html.ts'
import { webSearch } from '../lib/search.ts'
import { summarizeText } from '../lib/summarize.ts'

export const researchInput = z.object({
  topic: z.string().min(1),
  depth: z.number().int().positive().default(3),
  sentences: z.number().int().positive().default(2),
})

const sourceItem = z.object({ title: z.string(), url: z.string() })

export const researchOutput = z.object({
  topic: z.string(),
  report: z.string(),
  sources: z.array(sourceItem),
})

const searchStep = createStep({
  id: 'search',
  inputSchema: researchInput,
  outputSchema: z.object({
    topic: z.string(),
    depth: z.number(),
    sentences: z.number(),
    sources: z.array(sourceItem),
  }),
  execute: async ({ inputData }) => {
    const found = await webSearch(inputData.topic, inputData.depth)
    const sources = found.map((h) => ({ title: h.title, url: h.url }))
    return {
      topic: inputData.topic,
      depth: inputData.depth,
      sentences: inputData.sentences,
      sources,
    }
  },
})

const fetchSourcesStep = createStep({
  id: 'fetch-sources',
  inputSchema: z.object({
    topic: z.string(),
    depth: z.number(),
    sentences: z.number(),
    sources: z.array(sourceItem),
  }),
  outputSchema: z.object({
    topic: z.string(),
    sentences: z.number(),
    entries: z.array(z.object({ title: z.string(), url: z.string(), text: z.string() })),
  }),
  execute: async ({ inputData }) => {
    const entries = await Promise.all(
      inputData.sources.map(async (src) => {
        try {
          const html = await fetchText(src.url, { timeoutMs: 15_000 })
          const article = htmlToArticle(html)
          return { title: src.title, url: src.url, text: article.text || '' }
        } catch {
          return { title: src.title, url: src.url, text: '' }
        }
      }),
    )
    return { topic: inputData.topic, sentences: inputData.sentences, entries }
  },
})

function buildSection(
  entry: { title: string; url: string; text: string },
  idx: number,
  topN: number,
): string {
  const { sentences } = summarizeText(entry.text, topN)
  const body = sentences.length > 0 ? sentences.join(' ') : 'No extractable content.'
  return `## ${entry.title || `Source ${idx + 1}`}\n\n${body}\n\n> Source [${idx + 1}]: ${entry.url}`
}

const assembleStep = createStep({
  id: 'assemble',
  inputSchema: z.object({
    topic: z.string(),
    sentences: z.number(),
    entries: z.array(z.object({ title: z.string(), url: z.string(), text: z.string() })),
  }),
  outputSchema: researchOutput,
  execute: async ({ inputData }) => {
    const sections = inputData.entries.map((e, i) => buildSection(e, i, inputData.sentences))
    const report = `# Research: ${inputData.topic}\n\n${sections.join('\n\n')}`
    const sources = inputData.entries.map((e) => ({ title: e.title, url: e.url }))
    return { topic: inputData.topic, report, sources }
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
