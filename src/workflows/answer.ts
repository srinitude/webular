// ANSWER workflow: search -> fetch -> extractive synthesize, composed as a
// Mastra non-model workflow over FOSS tools (keyless search + readability + summarizer).
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { Effect } from 'effect'
import { z } from 'zod'
import { searchEffect } from '../lib/search-chain.ts'
import { mainEntity } from '../lib/search-hop.ts'
import { subjectSources } from '../lib/source-subject.ts'
import { fetchErrorsSchema, fetchSources } from '../lib/sources.ts'
import { summarizeText } from '../lib/summarize.ts'
import { stepRuntime } from './runtime.ts'

const answerInput = z.object({
  query: z.string().min(1),
  sources: z.number().int().min(1).max(10).default(3),
  sentences: z.number().int().min(1).max(25).default(3),
  timeoutMs: z.number().int().positive().optional(),
  urls: z.array(z.string()).min(1).optional(),
})

// Answer budgets: search (hop included) and each page fetch stop early, so a
// slow source costs a citation, not the whole answer. Pages fetch in parallel
// under fetchSources' fixed pool.
const ANSWER_SEARCH_MS = 4_000
const ANSWER_FETCH_MS = 3_000
// HTML cap before Readability: ~400 KB parses in about 1 s and keeps the lead.
const ANSWER_MAX_HTML = 400_000

const sourceRef = z.object({ title: z.string(), url: z.string() })

const answerOutput = z.object({
  query: z.string(),
  answer: z.string(),
  sources: z.array(sourceRef),
  errors: fetchErrorsSchema,
})

const hitsSchema = z.object({
  query: z.string(),
  sentences: z.number(),
  timeoutMs: z.number().optional(),
  hits: z.array(sourceRef),
})

const searchHits = (query: string, sources: number) =>
  Effect.map(
    searchEffect('web', query, sources, { hop: true, deadlineMs: ANSWER_SEARCH_MS }),
    ({ results }) => results.map((h) => ({ title: h.title, url: h.url })),
  )

const searchStep = createStep({
  id: 'search',
  inputSchema: answerInput,
  outputSchema: hitsSchema,
  execute: ({ inputData }) =>
    stepRuntime.runPromise(
      Effect.map(
        // --urls: read exactly those pages, no search.
        inputData.urls
          ? Effect.succeed(inputData.urls.map((url) => ({ title: url, url })))
          : searchHits(inputData.query, inputData.sources),
        (hits) => ({
          query: inputData.query,
          sentences: inputData.sentences,
          timeoutMs: inputData.timeoutMs,
          hits,
        }),
      ),
    ),
})

const synthesize = Effect.fn('answer.synthesize')(function* (input: z.infer<typeof hitsSchema>) {
  const fetched = yield* fetchSources(
    input.hits,
    input.timeoutMs ?? ANSWER_FETCH_MS,
    ANSWER_MAX_HTML,
  )
  // Cite only sources whose text actually fed the answer.
  // Namesake pages (a TV series named after the novel) drop out first.
  const used = yield* subjectSources(
    input.query,
    fetched.entries.filter((e) => e.text.length > 0),
  )
  const combined = used.map((e) => e.text).join('\n\n')
  // The lead hit names the entity when the question does not (a bridge hop).
  const entity = mainEntity(input.query) ?? input.hits[0]?.title
  const { summary } = summarizeText(combined, input.sentences, { query: input.query, entity })
  return {
    query: input.query,
    answer: summary,
    sources: used.map((e) => ({ title: e.title, url: e.url })),
    errors: fetched.errors,
  }
})

const synthStep = createStep({
  id: 'fetch-and-summarize',
  inputSchema: hitsSchema,
  outputSchema: answerOutput,
  execute: ({ inputData }) => stepRuntime.runPromise(synthesize(inputData)),
})

export const answerWorkflow = createWorkflow({
  id: 'answer',
  inputSchema: answerInput,
  outputSchema: answerOutput,
})
  .then(searchStep)
  .then(synthStep)
  .commit()
