// MONITOR workflow: fetch page → snapshot compare → emit change status.
// Composed as a Mastra non-model workflow over FOSS tools.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { fetchText } from '../core/http.ts'
import { htmlToArticle } from '../lib/html.ts'
import { compareAndStore } from '../lib/snapshot.ts'

export const monitorInput = z.object({
  url: z.string().url(),
  dbPath: z.string(),
})

export const monitorOutput = z.object({
  url: z.string(),
  changeStatus: z.enum(['new', 'same', 'changed']),
  diff: z.string().optional(),
})

const fetchStep = createStep({
  id: 'fetch',
  inputSchema: monitorInput,
  outputSchema: z.object({
    url: z.string(),
    dbPath: z.string(),
    text: z.string(),
  }),
  execute: async ({ inputData }) => {
    const html = await fetchText(inputData.url)
    const { text } = htmlToArticle(html)
    return { url: inputData.url, dbPath: inputData.dbPath, text }
  },
})

const snapshotStep = createStep({
  id: 'snapshot',
  inputSchema: z.object({
    url: z.string(),
    dbPath: z.string(),
    text: z.string(),
  }),
  outputSchema: monitorOutput,
  execute: async ({ inputData }) =>
    compareAndStore(inputData.dbPath, inputData.url, inputData.text),
})

export const monitorWorkflow = createWorkflow({
  id: 'monitor',
  inputSchema: monitorInput,
  outputSchema: monitorOutput,
})
  .then(fetchStep)
  .then(snapshotStep)
  .commit()
