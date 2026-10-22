// SUMMARIZE workflow: fetch optional URL → extractive sentence-scoring summary,
// composed as a Mastra non-model workflow over FOSS tools.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { Effect } from 'effect'
import { z } from 'zod'
import { htmlToArticle } from '../lib/html.ts'
import { type SummaryPick, topIndexes } from '../lib/jev/decisions/summarize.ts'
import { summaryFollowUp } from '../lib/jev/decisions/summary-follow-up.ts'
import { decisions } from '../lib/jev/decisions.ts'
import { decisionStep } from '../lib/jev/steps.ts'
import { fetchTextObeyingRobots } from '../lib/robots-gate.ts'
import { freeSourceFallback } from '../lib/sources/registry.ts'
import { rankSpans, type Span, sentenceSpans } from '../lib/summarize-rank.ts'
import { stepRuntime } from './runtime.ts'

const summarizeInput = z.object({
  text: z.string().optional(),
  url: z.url().optional(),
  sentences: z.number().int().min(1).max(25).default(3),
  timeoutMs: z.number().int().positive().optional(),
})

// A verbatim sentence with [start, end) offsets into the cleaned source text.
const pick = z.object({
  index: z.number().int(),
  start: z.number().int(),
  end: z.number().int(),
  text: z.string(),
  source_url: z.string().nullable(),
})
const summarizeOutput = z.object({
  sentences: z.array(z.string()),
  summary: z.string(),
  picks: z.array(pick),
  source_url: z.string().nullable(),
  reason: z.string().optional(),
})

// The cleaned text and the page it came from (null for --text input).
const resolved = z.object({
  text: z.string(),
  sentences: z.number(),
  source_url: z.string().nullable(),
})
type Resolved = z.infer<typeof resolved>

const fetchFrom = (url: string, timeoutMs?: number) =>
  Effect.map(fetchTextObeyingRobots(url, { timeoutMs }), (html) => ({ html, url }))

// The url first; when its fetch fails, the free sources routed to summarize
// name a page for it and that page is fetched instead (2603.01548). An empty
// page that fetched fine stands. The result names the page actually read.
const fetchPage = (url: string, timeoutMs?: number) =>
  fetchFrom(url, timeoutMs).pipe(
    Effect.catch((error) =>
      freeSourceFallback('summarize', url, 1).pipe(
        Effect.flatMap(({ results }) => fetchFrom(results[0]?.url ?? url, timeoutMs)),
        Effect.catch(() => Effect.fail(error)),
      ),
    ),
  )

// Only the extracted article text feeds the summarizer, never raw HTML.
const resolveStep = createStep({
  id: 'resolve',
  inputSchema: summarizeInput,
  outputSchema: resolved,
  execute: ({ inputData, abortSignal }) => {
    const { url, sentences } = inputData
    const page = url
      ? Effect.map(
          fetchPage(url, inputData.timeoutMs),
          (p): Resolved => ({
            text: htmlToArticle(p.html).text,
            sentences,
            source_url: p.url,
          }),
        )
      : Effect.succeed<Resolved>({ text: inputData.text ?? '', sentences, source_url: null })
    return stepRuntime.runPromise(page, { signal: abortSignal })
  },
})

const sameIndexes = (a: ReadonlyArray<number>, b: ReadonlyArray<number>) =>
  a.length === b.length && a.every((x, i) => x === b[i])

// Jev's swap stands; otherwise the MMR rule picks, keeping Jev's agreed lead.
// An empty source gets a reason.
export const result = (r: Resolved & { all: Span[] }, d?: SummaryPick) => {
  const chosen =
    d === undefined || sameIndexes(d.picks, topIndexes(r.text, r.sentences))
      ? rankSpans(r.text, r.sentences, d?.lead)
      : d.picks.flatMap((i) => r.all[i] ?? [])
  const reason = r.source_url ? 'The page has no readable text.' : 'The text has no sentences.'
  return {
    sentences: chosen.map((s) => s.text),
    summary: chosen.map((s) => s.text).join(' '),
    picks: chosen.map((s) => ({ ...s, source_url: r.source_url })),
    source_url: r.source_url,
    ...(chosen.length === 0 ? { reason } : {}),
  }
}

// The MMR rule picks; Jev's agreed lead sentence may replace the frequency rule's weakest pick.
const extractStep = decisionStep({
  id: 'extract',
  inputSchema: resolved,
  outputSchema: summarizeOutput,
  decide: (input: { text: string; topN: number }) =>
    Effect.flatMap(decisions.summary(input), (picks) => summaryFollowUp(input, picks)),
  prepare: (data: Resolved) => ({ ...data, all: sentenceSpans(data.text) }),
  pick: ({ text, sentences, all }) => (all.length === 0 ? undefined : { text, topN: sentences }),
  output: result,
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
