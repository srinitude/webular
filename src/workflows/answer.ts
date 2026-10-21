// ANSWER workflow: search -> fetch -> extractive synthesize, composed as a
// Mastra non-model workflow over FOSS tools (keyless search + readability + summarizer).
// Jev picks which hits to fetch, drops off-topic sources, and picks the lead
// sentence, each at the 0.95 bar; below it the plain rule decides.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { Effect } from 'effect'
import { z } from 'zod'
import { answerSentences } from '../lib/jev/decisions/answer.ts'
import { citedSources } from '../lib/jev/decisions/answer-citation.ts'
import { onJevRuntime } from '../lib/jev/decisions/search.ts'
import { decisions } from '../lib/jev/decisions.ts'
import { decisionStep } from '../lib/jev/steps.ts'
import { readabilitySchema, withReadability } from '../lib/readability-chain.ts'
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

const answerBody = z.object({
  query: z.string(),
  answer: z.string(),
  sources: z.array(sourceRef),
  errors: fetchErrorsSchema,
})
const answerOutput = answerBody.extend({ readability: readabilitySchema })

const evidenceSchema = z.object({
  query: z.string(),
  sentences: z.number(),
  // The lead hit names the entity when the question does not (a bridge hop).
  entity: z.string().optional(),
  used: z.array(sourceRef.extend({ text: z.string() })),
  errors: fetchErrorsSchema,
})
type Evidence = z.infer<typeof evidenceSchema>

const searchHits = (query: string, n: number) =>
  Effect.map(
    searchEffect('web', query, n, { hop: true, deadlineMs: ANSWER_SEARCH_MS }),
    ({ results }) => results,
  )

// --urls reads exactly those pages, no search. Otherwise over-fetch 3x so Jev can
// pick which hits to fetch (else the engine's first N). Namesake pages (a TV
// series named after the novel) drop out, then Jev keeps only the fetched
// sources that hold facts answering the query.
const gather = Effect.fn('answer.gather')(function* (input: z.infer<typeof answerInput>) {
  const hits = input.urls
    ? input.urls.map((url) => ({ title: url, url }))
    : yield* onJevRuntime(decisions.answerHits, {
        question: input.query,
        hits: yield* searchHits(input.query, input.sources * 3),
        n: input.sources,
      })
  const fetched = yield* fetchSources(
    hits.map((h) => ({ title: h.title, url: h.url })),
    input.timeoutMs ?? ANSWER_FETCH_MS,
    ANSWER_MAX_HTML,
  )
  const withText = yield* subjectSources(
    input.query,
    fetched.entries.filter((e) => e.text.length > 0),
  )
  const used =
    withText.length === 0
      ? withText
      : yield* onJevRuntime(decisions.answerSources, { question: input.query, sources: withText })
  const entity = mainEntity(input.query) ?? hits[0]?.title
  const { query, sentences } = input
  return { query, sentences, entity, used: [...used], errors: fetched.errors }
})

const searchStep = createStep({
  id: 'search',
  inputSchema: answerInput,
  outputSchema: evidenceSchema,
  execute: ({ inputData }) => stepRuntime.runPromise(gather(inputData)),
})

const topSentences = (text: string, data: Pick<Evidence, 'query' | 'sentences' | 'entity'>) =>
  summarizeText(text, data.sentences, { query: data.query, entity: data.entity }).sentences

// The summarizer's top sentences, led by the sentence Jev picks as the direct answer.
// Cited sources are those that back one of the summarizer's top sentences (answer.citation).
// ponytail: Jev sees only the first 18 sentences; rank more when pages run long.
// ponytail: citations are checked against the summarizer's top sentences, not the Jev lead.
const prepareSynth = Effect.fn('answer.prepare')(function* (data: Evidence) {
  const text = data.used.map((e) => e.text).join('\n\n')
  const cited = yield* citedSources(topSentences(text, data), data.used, (c) =>
    onJevRuntime(decisions.answerCitation, c),
  )
  return { ...data, text, cited }
})
// The direct answer Jev picked always opens the answer, never repeated.
export const leadFirst = (top: ReadonlyArray<string>, lead: string | undefined, n: number) =>
  lead === undefined ? [...top] : [lead, ...top.filter((s) => s !== lead)].slice(0, n)
const synthStep = decisionStep({
  id: 'fetch-and-summarize',
  inputSchema: evidenceSchema,
  outputSchema: answerBody,
  decide: decisions.answerSentence,
  prepare: (data: Evidence) => stepRuntime.runPromise(prepareSynth(data)),
  pick: ({ query, text }) => (text ? { question: query, text } : undefined),
  output: (data, lead) => {
    const { query, text, sentences, cited, errors } = data
    const top = topSentences(text, data)
    const first = lead === undefined ? undefined : answerSentences(text)[lead]
    return {
      query,
      answer: leadFirst(top, first, sentences).join(' '),
      sources: cited.map((e) => ({ title: e.title, url: e.url })),
      errors,
    }
  },
})

// The readability chain checks the finished answer text; the text stays as is.
const readabilityStep = createStep({
  id: 'readability',
  inputSchema: answerBody,
  outputSchema: answerOutput,
  execute: ({ inputData }) => stepRuntime.runPromise(withReadability('answer')(inputData)),
})

export const answerWorkflow = createWorkflow({
  id: 'answer',
  inputSchema: answerInput,
  outputSchema: answerOutput,
})
  .then(searchStep)
  .then(synthStep)
  .then(readabilityStep)
  .commit()
