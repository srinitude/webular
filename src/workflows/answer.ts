// ANSWER workflow: search -> fetch -> extractive synthesize, composed as a
// Mastra non-model workflow over FOSS tools (keyless search + readability + summarizer).
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { fetchText } from '../core/http.ts'
import { htmlToArticle } from '../lib/html.ts'
import { webSearch } from '../lib/search.ts'
import { summarizeText } from '../lib/summarize.ts'

export const answerInput = z.object({
  query: z.string().min(1),
  sources: z.number().int().min(1).default(3),
  sentences: z.number().int().min(1).default(3),
})

const sourceRef = z.object({ title: z.string(), url: z.string() })

export const answerOutput = z.object({
  query: z.string(),
  answer: z.string(),
  sources: z.array(sourceRef),
})

const hitsSchema = z.object({
  query: z.string(),
  sentences: z.number(),
  hits: z.array(sourceRef),
})

const searchStep = createStep({
  id: 'search',
  inputSchema: answerInput,
  outputSchema: hitsSchema,
  execute: async ({ inputData }) => {
    const found = await webSearch(inputData.query, inputData.sources)
    const hits = found.map((h) => ({ title: h.title, url: h.url }))
    return { query: inputData.query, sentences: inputData.sentences, hits }
  },
})

async function fetchArticleText(url: string): Promise<string> {
  try {
    return htmlToArticle(await fetchText(url, { timeoutMs: 15_000 })).text || ''
  } catch {
    return ''
  }
}

const synthStep = createStep({
  id: 'fetch-and-summarize',
  inputSchema: hitsSchema,
  outputSchema: answerOutput,
  execute: async ({ inputData }) => {
    const texts = await Promise.all(inputData.hits.map((h) => fetchArticleText(h.url)))
    const combined = texts.filter((t) => t.length > 0).join('\n\n')
    const { summary } = summarizeText(combined, inputData.sentences)
    return { query: inputData.query, answer: summary, sources: inputData.hits }
  },
})

export const answerWorkflow = createWorkflow({
  id: 'answer',
  inputSchema: answerInput,
  outputSchema: answerOutput,
})
  .then(searchStep)
  .then(synthStep)
  .commit()
