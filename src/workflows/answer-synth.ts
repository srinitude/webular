// Answer synthesis: the Jev calls on the gathered evidence. The cited top
// sentences (answer.followers, then answer.citation), the lead figure (image
// router), and the lead sentence (answer.sentence) each read only the
// evidence, so they run at once. The lead sentence is asked even when a figure
// answers; the output then drops it, as when the step skipped the call.
import { Effect } from 'effect'
import { z } from 'zod'
import { answerFigure, pageImageSchema } from '../lib/answer-figure.ts'
import { answerPassage, isHeading, isSentence } from '../lib/answer-passage.ts'
import { asOfDate } from '../lib/as-of.ts'
import { citedSources } from '../lib/jev/decisions/answer-citation.ts'
import { answerCandidates } from '../lib/jev/decisions/answer-sentences.ts'
import { decisions } from '../lib/jev/decisions.ts'
import { onJevRuntime } from '../lib/jev/run.ts'
import { fetchErrorsSchema } from '../lib/sources.ts'

export const sourceRef = z.object({ title: z.string(), url: z.string() })

export const evidenceSchema = z.object({
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
// The decision runner; tests pass one with a fixed delay to time the step.
type Ask = typeof onJevRuntime

const topSentences = (data: Evidence) =>
  answerPassage(
    data.used.map((e) => e.text),
    data.sentences,
    { query: data.query, entity: data.entity },
  )

// The sentences Jev keeps as stating facts that answer the query (answer.followers),
// then the summarizer's top ones. Cited sources are those that back one of these
// top sentences (answer.citation). Jev sees the summarizer's best 18 sentences.
// ponytail: citations are checked against the top sentences, not the Jev lead.
const citedTop = Effect.fn('answer.cite')(function* (data: Evidence, text: string, ask: Ask) {
  const candidates = answerCandidates(data.query, text)
  const kept =
    candidates.length === 0
      ? []
      : yield* ask(decisions.answerFollowers, { question: data.query, candidates })
  const top = [...new Set([...kept.map((i) => candidates[i] ?? ''), ...topSentences(data)])]
    .filter(isSentence)
    .slice(0, data.sentences)
  const cited = yield* citedSources(top, data.used, (c) => ask(decisions.answerCitation, c))
  return { top, cited }
})

export const prepareSynth = Effect.fn('answer.prepare')(function* (
  data: Evidence,
  ask: Ask = onJevRuntime,
) {
  const text = data.used.map((e) => e.text).join('\n\n')
  const lead = data.used[0]
  const question = data.query
  const { cite, figure, leadIndex } = yield* Effect.all(
    {
      cite: citedTop(data, text, ask),
      // The image router puts the lead source's answer in a figure: cite it, claim no sure sentence.
      figure: ask(answerFigure, { question, lead }),
      leadIndex: text
        ? ask(decisions.answerSentence, { question, text })
        : Effect.succeed(undefined),
    },
    { concurrency: 3 },
  )
  const sources = figure && lead && !cite.cited.includes(lead) ? [lead, ...cite.cited] : cite.cited
  const picked = figure ? undefined : leadIndex
  return {
    ...data,
    text,
    top: cite.top,
    cited: sources,
    figure,
    lead: picked,
    asOf: yield* asOfDate,
  }
})

// Jev's direct answer opens the answer, never repeated; a heading line never leads it.
export const leadFirst = (top: ReadonlyArray<string>, lead: string | undefined, n: number) =>
  lead === undefined || isHeading(lead)
    ? [...top]
    : [lead, ...top.filter((s) => s !== lead)].slice(0, n)
