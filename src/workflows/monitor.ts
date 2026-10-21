// MONITOR workflow: fetch page → snapshot compare → emit change status.
// Composed as a Mastra non-model workflow over FOSS tools.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { Effect } from 'effect'
import { z } from 'zod'
import { fetchText } from '../core/http.ts'
import { htmlToArticle } from '../lib/html.ts'
import { compareAndStore } from '../lib/snapshot.ts'
import { stepRuntime } from './runtime.ts'

const monitorInput = z.object({
  url: z.url(),
  dbPath: z.string(),
  timeoutMs: z.number().int().positive().optional(),
})

const monitorOutput = z.object({
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
  execute: ({ inputData }) =>
    stepRuntime.runPromise(
      Effect.map(fetchText(inputData.url, { timeoutMs: inputData.timeoutMs }), (html) => ({
        url: inputData.url,
        dbPath: inputData.dbPath,
        text: htmlToArticle(html).text,
      })),
    ),
})

const snapshotStep = createStep({
  id: 'snapshot',
  inputSchema: z.object({
    url: z.string(),
    dbPath: z.string(),
    text: z.string(),
  }),
  outputSchema: monitorOutput,
  execute: ({ inputData }) =>
    stepRuntime.runPromise(compareAndStore(inputData.dbPath, inputData.url, inputData.text)),
})

export const monitorWorkflow = createWorkflow({
  id: 'monitor',
  inputSchema: monitorInput,
  outputSchema: monitorOutput,
})
  .then(fetchStep)
  .then(snapshotStep)
  .commit()
