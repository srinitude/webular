// SUMMARIZE workflow: fetch optional URL → extractive sentence-scoring summary,
// composed as a Mastra non-model workflow over FOSS tools.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { Effect } from 'effect'
import { z } from 'zod'
import { fetchText } from '../core/http.ts'
import { htmlToArticle } from '../lib/html.ts'
import { allSentences } from '../lib/jev/decisions/summarize.ts'
import { summaryFollowUp } from '../lib/jev/decisions/summary-follow-up.ts'
import { decisions } from '../lib/jev/decisions.ts'
import { decisionStep } from '../lib/jev/steps.ts'
import { freeSourceFallback } from '../lib/sources/registry.ts'
import { summarizeText } from '../lib/summarize.ts'
import { stepRuntime } from './runtime.ts'

const summarizeInput = z.object({
  text: z.string().optional(),
  url: z.url().optional(),
  sentences: z.number().int().min(1).max(25).default(3),
  timeoutMs: z.number().int().positive().optional(),
})

const summarizeOutput = z.object({
  sentences: z.array(z.string()),
  summary: z.string(),
})

// The url first; when its fetch fails, the free sources routed to summarize
// name a page for it and that page is fetched instead (2603.01548). An empty
// page that fetched fine stands.
const fetchPage = (url: string, timeoutMs?: number) =>
  fetchText(url, { timeoutMs }).pipe(
    Effect.catch((error) =>
      freeSourceFallback('summarize', url, 1).pipe(
        Effect.flatMap(({ results }) => fetchText(results[0]?.url ?? url, { timeoutMs })),
        Effect.catch(() => Effect.fail(error)),
      ),
    ),
  )

const resolveStep = createStep({
  id: 'resolve',
  inputSchema: summarizeInput,
  outputSchema: z.object({ text: z.string(), sentences: z.number() }),
  execute: ({ inputData }) => {
    const { url, sentences } = inputData
    const text = url
      ? Effect.map(fetchPage(url, inputData.timeoutMs), (html) => htmlToArticle(html).text || html)
      : Effect.succeed(inputData.text ?? '')
    return stepRuntime.runPromise(Effect.map(text, (t) => ({ text: t, sentences })))
  },
})

// The word-frequency rule picks; Jev's agreed lead sentence may replace its weakest pick.
const extractStep = decisionStep({
  id: 'extract',
  inputSchema: z.object({ text: z.string(), sentences: z.number() }),
  outputSchema: summarizeOutput,
  decide: (input: { text: string; topN: number }) =>
    Effect.flatMap(decisions.summary(input), (picks) => summaryFollowUp(input, picks)),
  prepare: (data: { text: string; sentences: number }) => data,
  pick: ({ text, sentences }) => ({ text, topN: sentences }),
  output: ({ text, sentences }, picks) => {
    if (picks === undefined) return summarizeText(text, sentences)
    const all = allSentences(text)
    const chosen = picks.flatMap((i) => all[i] ?? [])
    return { sentences: chosen, summary: chosen.join(' ') }
  },
})

export const summarizeWorkflow = createWorkflow({
  id: 'summarize',
  inputSchema: summarizeInput,
  outputSchema: summarizeOutput,
  options: { shouldPersistSnapshot: () => false },
})
  .then(resolveStep)
  .then(extractStep)
  .commit()
