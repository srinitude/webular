// MONITOR workflow: fetch page → snapshot compare → emit change status.
// Composed as a Mastra non-model workflow over FOSS tools.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { Effect } from 'effect'
import { z } from 'zod'
import { fetchText } from '../core/http.ts'
import { htmlToArticle } from '../lib/html.ts'
import { compareAndStore } from '../lib/snapshot.ts'
import { freeSourceFallback } from '../lib/sources/registry.ts'
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

const MAX_SNAPSHOTS = 3

// The page itself; when it fails to load, the closest archived snapshots the
// free sources list for the url, in rank order. With none, the page's own
// error stands.
const pageHtml = (url: string, timeoutMs: number | undefined) =>
  fetchText(url, { timeoutMs }).pipe(
    Effect.catch((err) =>
      freeSourceFallback('monitor', url, MAX_SNAPSHOTS).pipe(
        Effect.flatMap(({ results }) =>
          Effect.firstSuccessOf(results.map((hit) => fetchText(hit.url, { timeoutMs }))),
        ),
        Effect.mapError(() => err),
      ),
    ),
  )

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
      Effect.map(pageHtml(inputData.url, inputData.timeoutMs), (html) => ({
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
