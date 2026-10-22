// ANSWER workflow: search -> fetch -> extractive synthesize, composed as a
// Mastra non-model workflow over FOSS tools (keyless search + readability + summarizer).
// Jev picks which hits to fetch, drops off-topic sources, and picks the lead
// sentence, each at the 0.95 bar; below it the plain rule decides.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { Effect } from 'effect'
import { z } from 'zod'
import { nameCountry } from '../lib/answer-country.ts'
import { answerFigure, figureNote, pageImageSchema } from '../lib/answer-figure.ts'
import { answerPassage, isSentence } from '../lib/answer-passage.ts'
import { asOfDate } from '../lib/as-of.ts'
import { answerSentences } from '../lib/jev/decisions/answer.ts'
import { citedSources } from '../lib/jev/decisions/answer-citation.ts'
import { answerCandidates } from '../lib/jev/decisions/answer-sentences.ts'
import { decisions } from '../lib/jev/decisions.ts'
import { onJevRuntime } from '../lib/jev/run.ts'
import { decisionStep } from '../lib/jev/steps.ts'
import { readabilitySchema, withReadability } from '../lib/readability-chain.ts'
import { searchEffect } from '../lib/search-chain.ts'
import { searchErrors } from '../lib/search-errors.ts'
import { mainEntity } from '../lib/search-hop.ts'
import { nestedBridge } from '../lib/search-nested.ts'
import { subjectSources } from '../lib/source-subject.ts'
import { fetchErrorsSchema, fetchSources, withRows } from '../lib/sources.ts'
import { fetchedOnly, finishAnswer } from './answer-guard.ts'
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

const answerBody = z.object({
  query: z.string(),
  answer: z.string(),
  // Run date the answer is grounded on (WEBULAR_AS_OF or the clock).
  asOf: z.string(),
  sources: z.array(sourceRef),
  errors: fetchErrorsSchema,
})
const answerOutput = answerBody.extend({ readability: readabilitySchema })

const evidenceSchema = z.object({
  query: z.string(),
  sentences: z.number(),
  // The lead hit names the entity when the question does not (a bridge hop).
  entity: z.string().optional(),
  used: z.array(
    sourceRef.extend({ text: z.string(), images: z.array(pageImageSchema).optional() }),
  ),
  errors: fetchErrorsSchema,
})
type Evidence = z.infer<typeof evidenceSchema>

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

const topSentences = (data: Evidence) =>
  answerPassage(
    data.used.map((e) => e.text),
    data.sentences,
    { query: data.query, entity: data.entity },
  )

// The sentences Jev keeps as stating facts that answer the query (answer.sentences),
// then the summarizer's top ones, led by the sentence Jev picks as the direct answer.
// Cited sources are those that back one of these top sentences (answer.citation).
// Jev sees the summarizer's best 18 sentences, ranked over the whole page.
// ponytail: citations are checked against the top sentences, not the Jev lead.
const prepareSynth = Effect.fn('answer.prepare')(function* (data: Evidence) {
  const text = data.used.map((e) => e.text).join('\n\n')
  const candidates = answerCandidates(data.query, text)
  const kept =
    candidates.length === 0
      ? []
      : yield* onJevRuntime(decisions.answerFollowers, { question: data.query, candidates })
  const top = [...new Set([...kept.map((i) => candidates[i] ?? ''), ...topSentences(data)])]
    .filter(isSentence)
    .slice(0, data.sentences)
  const cited = yield* citedSources(top, data.used, (c) =>
    onJevRuntime(decisions.answerCitation, c),
  )
  // The image router puts the lead source's answer in a figure: cite it, claim no sure sentence.
  const lead = data.used[0]
  const figure = yield* onJevRuntime(answerFigure, { question: data.query, lead })
  const sources = figure && lead && !cited.includes(lead) ? [lead, ...cited] : cited
  return { ...data, text, top, cited: sources, figure, asOf: yield* asOfDate }
})
// Jev's direct answer opens the answer, never repeated; a heading line never leads it.
export const leadFirst = (top: ReadonlyArray<string>, lead: string | undefined, n: number) =>
  lead === undefined || !isSentence(lead)
    ? [...top]
    : [lead, ...top.filter((s) => s !== lead)].slice(0, n)
const synthStep = decisionStep({
  id: 'fetch-and-summarize',
  inputSchema: evidenceSchema,
  outputSchema: answerBody,
  decide: decisions.answerSentence,
  prepare: (data: Evidence) => stepRuntime.runPromise(prepareSynth(data)),
  pick: ({ query, text, figure }) => (text && !figure ? { question: query, text } : undefined),
  output: ({ query, text, sentences, top, cited, used, figure, errors, asOf }, lead) => {
    const first = lead === undefined ? undefined : answerSentences(text)[lead]
    const body = finishAnswer(query, cited, leadFirst(top, first, sentences).join(' '))
    return {
      query,
      answer: nameCountry(query, figure ? `${figureNote(figure)} ${body}` : body),
      asOf,
      sources: fetchedOnly(cited, used).map((e) => ({ title: e.title, url: e.url })),
      errors,
    }
  },
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
