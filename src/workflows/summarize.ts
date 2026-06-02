// SUMMARIZE workflow: fetch optional URL → extractive sentence-scoring summary,
// composed as a Mastra non-model workflow over FOSS tools.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { fetchText } from '../core/http.ts'
import { htmlToArticle } from '../lib/html.ts'
import { summarizeText } from '../lib/summarize.ts'

export const summarizeInput = z.object({
  text: z.string().optional(),
  url: z.string().url().optional(),
  sentences: z.number().int().positive().default(3),
})

export const summarizeOutput = z.object({
  sentences: z.array(z.string()),
  summary: z.string(),
})

const resolveStep = createStep({
  id: 'resolve',
  inputSchema: summarizeInput,
  outputSchema: z.object({ text: z.string(), sentences: z.number() }),
  execute: async ({ inputData }) => {
    if (inputData.url) {
      const html = await fetchText(inputData.url)
      const article = htmlToArticle(html)
      return { text: article.text || html, sentences: inputData.sentences }
    }
    return { text: inputData.text ?? '', sentences: inputData.sentences }
  },
})

const extractStep = createStep({
  id: 'extract',
  inputSchema: z.object({ text: z.string(), sentences: z.number() }),
  outputSchema: summarizeOutput,
  execute: async ({ inputData }) => summarizeText(inputData.text, inputData.sentences),
})

export const summarizeWorkflow = createWorkflow({
  id: 'summarize',
  inputSchema: summarizeInput,
  outputSchema: summarizeOutput,
})
  .then(resolveStep)
  .then(extractStep)
  .commit()
