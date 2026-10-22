// ANSWER workflow: search -> fetch -> extractive synthesize, composed as a
// Mastra non-model workflow over FOSS tools (keyless search + readability + summarizer).
// Jev picks which hits to fetch, drops off-topic sources, and picks the lead
// sentence, each at the 0.95 bar; below it the plain rule decides.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { Effect } from 'effect'
import { z } from 'zod'
import { nameCountry } from '../lib/answer-country.ts'
import { figureNote } from '../lib/answer-figure.ts'
import { answerSentences } from '../lib/jev/decisions/answer.ts'
import { decisions } from '../lib/jev/decisions.ts'
import { onJevRuntime } from '../lib/jev/run.ts'
import { readabilitySchema, withReadability } from '../lib/readability-chain.ts'
import { searchEffect } from '../lib/search-chain.ts'
import { searchErrors } from '../lib/search-errors.ts'
import { mainEntity } from '../lib/search-hop.ts'
import { nestedBridge } from '../lib/search-nested.ts'
import { subjectSources } from '../lib/source-subject.ts'
import { fetchErrorsSchema, fetchSources, withRows } from '../lib/sources.ts'
import { fetchedOnly, finishAnswer } from './answer-guard.ts'
import { evidenceSchema, leadFirst, prepareSynth, sourceRef } from './answer-synth.ts'
import { stepRuntime } from './runtime.ts'

export { leadFirst }

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

const answerBody = z.object({
  query: z.string(),
  answer: z.string(),
  // Run date the answer is grounded on (WEBULAR_AS_OF or the clock).
  asOf: z.string(),
  sources: z.array(sourceRef),
  errors: fetchErrorsSchema,
})
const answerOutput = answerBody.extend({ readability: readabilitySchema })

const searchHits = (query: string, n: number) =>
  searchEffect('web', query, n, { hop: true, deadlineMs: ANSWER_SEARCH_MS })

// --urls reads exactly those pages, no search. Otherwise over-fetch 3x so Jev can
// pick which hits to fetch (else the engine's first N). Namesake pages (a TV
// series named after the novel) drop out, then Jev keeps only the fetched
// sources that hold facts answering the query.
const gather = Effect.fn('answer.gather')(function* (input: z.infer<typeof answerInput>) {
  const searched = input.urls ? undefined : yield* searchHits(input.query, input.sources * 3)
  const hits = searched
    ? yield* onJevRuntime(decisions.answerHits, {
        question: input.query,
        hits: searched.results,
        n: input.sources,
      })
    : (input.urls ?? []).map((url) => ({ title: url, url }))
  const fetched = yield* fetchSources(
    hits.map((h) => ({ title: h.title, url: h.url })),
    input.timeoutMs ?? ANSWER_FETCH_MS,
    ANSWER_MAX_HTML,
    input.urls !== undefined,
  )
  const withText = yield* subjectSources(
    input.query,
    fetched.entries.map(withRows).filter((e) => e.text.length > 0),
  )
  const used =
    withText.length === 0
      ? withText
      : yield* onJevRuntime(decisions.answerSources, { question: input.query, sources: withText })
  const entity = mainEntity(input.query) ?? hits[0]?.title
  const { query, sentences } = input
  const errors = [...searchErrors(searched), ...fetched.errors]
  return { query, sentences, entity, used: [...used], errors }
})

// A nested question ("the capital of the country that hosted ...") takes its
// bridge country from the first round's pages, then asks the outer question.
const gatherBridged = Effect.fn('answer.bridge')(function* (input: z.infer<typeof answerInput>) {
  const first = yield* gather(input)
  const bridged = input.urls
    ? undefined
    : nestedBridge(
        input.query,
        first.used.map((e) => e.text),
      )
  return bridged ? yield* gather({ ...input, query: bridged }) : first
})

const searchStep = createStep({
  id: 'search',
  inputSchema: answerInput,
  outputSchema: evidenceSchema,
  execute: ({ inputData, abortSignal }) =>
    stepRuntime.runPromise(gatherBridged(inputData), { signal: abortSignal }),
})

// The lead index is Jev's answer.sentence pick, asked alongside the other synth calls.
const synthOut = (p: Effect.Success<ReturnType<typeof prepareSynth>>) => {
  const { query, text, sentences, top, cited, used, figure, errors, asOf, lead } = p
  const first = lead === undefined ? undefined : answerSentences(text)[lead]
  const body = finishAnswer(query, cited, leadFirst(top, first, sentences).join(' '))
  return {
    query,
    answer: nameCountry(query, figure ? `${figureNote(figure)} ${body}` : body),
    asOf,
    sources: fetchedOnly(cited, used).map((e) => ({ title: e.title, url: e.url })),
    errors,
  }
}
const synthStep = createStep({
  id: 'fetch-and-summarize',
  inputSchema: evidenceSchema,
  outputSchema: answerBody,
  execute: ({ inputData, abortSignal }) =>
    stepRuntime.runPromise(Effect.map(prepareSynth(inputData), synthOut), { signal: abortSignal }),
})

// The readability chain checks the finished answer text; the text stays as is.
const readabilityStep = createStep({
  id: 'readability',
  inputSchema: answerBody,
  outputSchema: answerOutput,
  execute: ({ inputData, abortSignal }) =>
    stepRuntime.runPromise(withReadability('answer')(inputData), { signal: abortSignal }),
})

export const answerWorkflow = createWorkflow({
  id: 'answer',
  inputSchema: answerInput,
  outputSchema: answerOutput,
  options: { shouldPersistSnapshot: () => false },
})
  .then(searchStep)
  .then(synthStep)
  .then(readabilityStep)
  .commit()
