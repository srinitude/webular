// answer: which fetched sources hold facts that answer the question, and which
// sentence states the answer. Each acts only at the 0.95 bar and otherwise
// keeps the answer workflow's baseline.
import { summarizeText } from '../../summarize.ts'
import type { JevAnswer } from '../client.ts'
import { defineDecision } from '../define.ts'
import {
  agreedPick,
  bothOrders,
  CONFIDENCE_BAR,
  choice,
  menu,
  noul,
  purpose,
  sureYes,
} from '../payload/index.ts'
import { topIndexes } from './summarize.ts'

const DOCS = '88a6a003018eaea50167565a766a0d4a91d039cf93cc7dc2965d3ceba3a72caf'
const MAX_ITEMS = 20 // one call carries at most 20 questions
const MAX_SENTENCES = 18 // 18 options + `none`, asked twice
const MAX_QUESTION = 300
const MAX_SENTENCE = 600
const MAX_SOURCE = 2_000
const asked = (q: string) => ({ text: q.slice(0, MAX_QUESTION) })

// ── sources: which fetched pages hold facts that answer the question ──
interface Source {
  readonly title: string
  readonly url: string
  readonly text: string
}
interface SourcesInput {
  readonly question: string
  readonly sources: ReadonlyArray<Source>
}
const sourcesBaseline = ({ sources }: SourcesInput) => sources.filter((s) => s.text.length > 0)
const SOURCES_PURPOSE = purpose(
  'We answer a reader question from fetched web pages and cite them.',
  'Keep only the pages that hold facts answering the question.',
  'An off-topic page adds wrong sentences and a false citation.',
  'Search results mix answer pages with related topics, ads, and site chrome.',
)
const sourcesPayload = (input: SourcesInput) => {
  // Lazy: stops after MAX_ITEMS kept, so reads do not grow with the list.
  const items = input.sources
    .values()
    .filter((s) => s.text.length > 0)
    .take(MAX_ITEMS)
    .toArray()
  return {
    state: {
      purpose: SOURCES_PURPOSE,
      facts: {
        question: asked(input.question),
        sources: Object.fromEntries(
          items.map((s, i) => [`p${i}`, { title: s.title, text: s.text.slice(0, MAX_SOURCE) }]),
        ),
      },
    },
    questions: Object.fromEntries(
      items.map((_, i) => [
        `p${i}`,
        noul(`Does \`facts.sources.p${i}\` hold facts that answer \`facts.question.text\`?`),
      ]),
    ),
  }
}
// A source drops only on a sure no; unsure sources stay, as in the baseline.
const sourcesRead = (a: Record<string, JevAnswer>, t: number, input: SourcesInput) =>
  sourcesBaseline(input).filter((_, i) => i >= MAX_ITEMS || sureYes(a[`p${i}`], t) !== false)
// At least one source stays, and every kept one had text.
const sourcesCodeCheck = (kept: ReadonlyArray<Source>, input: SourcesInput) =>
  kept.length > 0 && kept.every((s) => sourcesBaseline(input).includes(s))

export const answerSources = defineDecision<SourcesInput, ReadonlyArray<Source>>({
  name: 'answer.sources',
  sample: () => ({
    question: 'what sqlite driver does bun ship',
    sources: [
      { title: 'Bun', url: 'https://bun.sh', text: 'Bun ships bun:sqlite, a SQLite driver.' },
      { title: 'Shop', url: 'https://shop.example', text: 'Buy shoes today.' },
    ],
  }),
  subtasks: [{ name: 'holds', primitive: 'noul', pattern: 'fan-out', payload: { question: 'p0' } }],
  payload: sourcesPayload,
  read: sourcesRead,
  bar: CONFIDENCE_BAR,
  fallback: sourcesBaseline,
  codeCheck: sourcesCodeCheck,
  evals: 'tests/jev/evals/answer.sources.json',
  docs: DOCS,
})

// ── sentence: which sentence states the answer ──
interface SentenceInput {
  readonly question: string
  readonly text: string
}
export const answerSentences = (text: string) =>
  summarizeText(text, Number.POSITIVE_INFINITY).sentences
// Baseline: the summarizer's top sentence, which ignores the question.
const sentenceBaseline = ({ text }: SentenceInput) =>
  Math.max(0, answerSentences(text).indexOf(summarizeText(text, 1).sentences[0] ?? ''))
const SENTENCE_PURPOSE = purpose(
  'We answer a reader question with sentences taken from web pages.',
  'The answer opens with the sentence that states the answer itself.',
  'A lead sentence that only repeats the topic wastes the reader time.',
  'Pages often repeat the topic words in sentences that never give the answer.',
)
// The summarizer's best 18 sentences in text order; ids keep each one's original index.
const shortlist = (text: string) => topIndexes(text, MAX_SENTENCES)
const sentenceText = (k: string) =>
  k === 'none'
    ? 'Only when no sentence states the answer'
    : `Sentence \`facts.text.sentences.${k}\``
const sentencePayload = (input: SentenceInput) => {
  const all = answerSentences(input.text)
  const keep = shortlist(input.text)
  const ids = keep.map((i) => `s${i}`)
  const base = `s${sentenceBaseline(input)}`
  return {
    state: {
      purpose: SENTENCE_PURPOSE,
      facts: {
        question: asked(input.question),
        text: {
          default: base,
          sentences: Object.fromEntries(
            keep.map((i) => [`s${i}`, (all[i] ?? '').slice(0, MAX_SENTENCE)]),
          ),
        },
      },
    },
    // Asked in both option orders (position check); the summarizer's pick comes first.
    questions: bothOrders(
      'lead',
      choice(
        'Which entry of `facts.text.sentences` states the answer to `facts.question.text` itself?',
        menu(base, ids, sentenceText),
      ),
    ),
  }
}

// An original index naming one of the sentences Jev saw.
const sentenceCodeCheck = (i: number, { text }: SentenceInput) => shortlist(text).includes(i)

export const answerSentence = defineDecision<SentenceInput, number>({
  name: 'answer.sentence',
  sample: () => ({
    question: 'what sqlite driver does bun ship',
    text: 'Bun is fast. Bun Bun Bun is loved by Bun fans. Bun ships a SQLite driver called bun:sqlite.',
  }),
  subtasks: [
    {
      name: 'lead',
      primitive: 'choice',
      pattern: 'confidence-routing',
      payload: { question: 'lead' },
    },
  ],
  payload: sentencePayload,
  read: (a, t) => {
    const pick = agreedPick(a, 'lead', t)
    return pick === undefined ? undefined : Number(pick.slice(1))
  },
  bar: CONFIDENCE_BAR,
  fallback: sentenceBaseline,
  codeCheck: sentenceCodeCheck,
  evals: 'tests/jev/evals/answer.sentence.json',
  docs: DOCS,
})
