// MONITOR workflow: fetch page and compare with the snapshot → judge the change.
// Composed as a Mastra workflow over FOSS tools; Jev goes through decisionStep.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { Effect } from 'effect'
import { z } from 'zod'
import { fetchText } from '../core/http.ts'
import { htmlToArticle } from '../lib/html.ts'
import { decisions } from '../lib/jev/decisions.ts'
import { decisionStep } from '../lib/jev/steps.ts'
import { compareAndStore } from '../lib/snapshot.ts'
import { freeSourceFallback } from '../lib/sources/registry.ts'
import { stepRuntime } from './runtime.ts'

const monitorInput = z.object({
  url: z.url(),
  dbPath: z.string(),
  timeoutMs: z.number().int().positive().optional(),
  // What the user watches for, in their words; Jev judges each change against it.
  watchFor: z.string().optional(),
})

const monitorOutput = z.object({
  url: z.string(),
  changeStatus: z.enum(['new', 'same', 'changed']),
  diff: z.string().optional(),
  matters: z.boolean().optional(),
})

const compared = monitorOutput.omit({ matters: true }).extend({ watchFor: z.string() })

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
  outputSchema: compared,
  execute: ({ inputData }) =>
    stepRuntime.runPromise(
      pageHtml(inputData.url, inputData.timeoutMs).pipe(
        Effect.flatMap((html) =>
          compareAndStore(inputData.dbPath, inputData.url, htmlToArticle(html).text),
        ),
        Effect.map((r) => ({ ...r, watchFor: inputData.watchFor ?? '' })),
      ),
    ),
})

// A changed page also gets `matters`: Jev's judgment that the diff changes
// the meaning, beyond dates, counters, ads, or ids (baseline without a key).
const snapshotStep = decisionStep({
  id: 'snapshot',
  inputSchema: compared,
  outputSchema: monitorOutput,
  decide: decisions.change,
  prepare: (d: z.infer<typeof compared>) => d,
  pick: ({ url, watchFor, changeStatus, diff }) =>
    changeStatus === 'changed' && diff ? { url, watchFor, diff } : undefined,
  output: ({ watchFor: _w, ...r }, matters) => (matters === undefined ? r : { ...r, matters }),
})

export const monitorWorkflow = createWorkflow({
  id: 'monitor',
  inputSchema: monitorInput,
  outputSchema: monitorOutput,
})
  .then(fetchStep)
  .then(snapshotStep)
  .commit()
