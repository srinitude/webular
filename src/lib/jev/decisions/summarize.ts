// summarize: which sentence is the text's most central one? Jev's agreed pick
// joins the word-frequency summarizer's top picks; the rule alone is the fallback.
import { Effect } from 'effect'
import { summarizeText } from '../../summarize.ts'
import { JEV_CONCURRENCY, type JevAnswer } from '../client.ts'
import { defineDecision } from '../define.ts'
import { agreedPick, bothOrders, CONFIDENCE_BAR, choice, menu, purpose } from '../payload/index.ts'

interface SummaryInput {
  readonly text: string
  readonly topN: number
}
const MAX_ITEMS = 20 // ponytail: texts past 20 sentences always keep the rule's picks
const MAX_SENTENCE = 600

// Every sentence of `text` in text order, split the way summarizeText splits it.
export const allSentences = (text: string) =>
  summarizeText(text, Number.POSITIVE_INFINITY).sentences

// Indexes of the summarizer's top `topN` sentences, in text order.
const topIndexes = (text: string, topN: number): ReadonlyArray<number> => {
  const all = allSentences(text)
  const used = new Set<number>()
  for (const s of summarizeText(text, topN).sentences) {
    const i = all.findIndex((t, j) => t === s && !used.has(j))
    if (i >= 0) used.add(i)
  }
  return [...used].sort((a, b) => a - b)
}
const summaryBaseline = ({ text, topN }: SummaryInput) => topIndexes(text, topN)

// Code check: indexes in range, unique, exactly min(topN, n), in text order.
const validPicks = (picks: ReadonlyArray<number>, { text, topN }: SummaryInput) => {
  const n = allSentences(text).length
  return (
    picks.length === Math.min(topN, n) &&
    picks.every(
      (p, i) => Number.isInteger(p) && p >= 0 && p < n && (i === 0 || p > (picks[i - 1] ?? -1)),
    )
  )
}

const SUMMARY_PURPOSE = purpose(
  'We summarize a web page by picking its most important sentences.',
  'The picked sentences tell a reader what the page is about and what it says.',
  'A summary made of filler sentences tells the reader nothing about the page.',
  'Greetings, sign-offs, and ads often repeat the topic words many times without adding a point.',
)

const describe = (k: string) =>
  k === 'none'
    ? 'Only when every sentence is a greeting, sign-off, ad, or aside'
    : `Sentence \`text.sentences.${k}\``

const summaryPayload = (input: SummaryInput) => {
  const items = allSentences(input.text).slice(0, MAX_ITEMS)
  const ids = items.map((_, i) => `s${i}`)
  const base = summaryBaseline(input).map((i) => `s${i}`)
  return {
    state: {
      purpose: SUMMARY_PURPOSE,
      default: { picks: base },
      text: {
        sentences: Object.fromEntries(items.map((s, i) => [`s${i}`, s.slice(0, MAX_SENTENCE)])),
      },
    },
    // Asked in both option orders (position check); the rule's first pick comes first.
    questions: bothOrders(
      'lead',
      choice(
        'If the summary could keep only one sentence, which entry of `text.sentences` should it keep so a reader learns what the text says?',
        menu(base[0] ?? 's0', ids, describe),
      ),
    ),
  }
}

// The agreed lead sentence joins the rule's top topN - 1; undefined lets the fallback decide.
const readSummary = (a: Record<string, JevAnswer>, t: number, input: SummaryInput) => {
  const lead = agreedPick(a, 'lead', t)
  if (lead === undefined || allSentences(input.text).length > MAX_ITEMS || input.topN < 1)
    return undefined
  const i = Number(lead.slice(1))
  const base = summaryBaseline(input)
  return base.includes(i)
    ? base
    : [...topIndexes(input.text, input.topN - 1), i].sort((x, y) => x - y)
}

export const summaryDecision = defineDecision<SummaryInput, ReadonlyArray<number>>({
  name: 'summarize.lead',
  sample: () => ({
    text: 'Hello and welcome, friends of Bun! Bun ships a built-in SQLite driver called bun:sqlite. Thanks for reading about Bun!',
    topN: 1,
  }),
  subtasks: [
    {
      name: 'lead',
      primitive: 'choice',
      pattern: 'confidence-routing',
      payload: { question: 'lead' },
    },
  ],
  payload: summaryPayload,
  read: readSummary,
  bar: CONFIDENCE_BAR,
  fallback: summaryBaseline,
  codeCheck: validPicks,
  evals: 'tests/jev/evals/summarize.lead.json',
  docs: '88a6a003018eaea50167565a766a0d4a91d039cf93cc7dc2965d3ceba3a72caf',
})

// Per-sentence follow-up: is sentence `i` a core point or filler? 'unsure' keeps the picks.
type Verdict = 'core' | 'filler' | 'unsure'
interface CoreInput {
  readonly text: string
  readonly i: number
}
const describeCore = (k: string) =>
  k === 'core'
    ? 'It states a point the text makes'
    : k === 'filler'
      ? 'Only when it is a greeting, sign-off, ad, aside, or a repeat of topic words'
      : 'Only when no other option fits'
const codeCheck = (_v: Verdict, { text, i }: CoreInput) =>
  Number.isInteger(i) && i >= 0 && i < Math.min(allSentences(text).length, MAX_ITEMS)

const corePayload = ({ text, i }: CoreInput) => ({
  state: {
    purpose: SUMMARY_PURPOSE,
    text: {
      sentences: Object.fromEntries(
        allSentences(text)
          .slice(0, MAX_ITEMS)
          .map((s, j) => [`s${j}`, s.slice(0, MAX_SENTENCE)]),
      ),
    },
    sentence: { id: `s${i}` },
  },
  // Asked in both option orders (position check); code acts only when both agree.
  questions: bothOrders(
    'core',
    choice(
      'Is the entry of `text.sentences` named by `sentence.id` a core point of the whole text?',
      menu('core', ['filler'], describeCore),
    ),
  ),
})

export const coreDecision = defineDecision<CoreInput, Verdict>({
  name: 'summarize.core',
  sample: () => ({
    text: 'Hello and welcome, friends of Bun! Bun ships a built-in SQLite driver called bun:sqlite.',
    i: 0,
  }),
  subtasks: [
    { name: 'core', primitive: 'choice', pattern: 'fan-out', payload: { question: 'core' } },
  ],
  payload: corePayload,
  read: (a, t) => {
    const v = agreedPick(a, 'core', t)
    return v === 'core' || v === 'filler' ? v : undefined
  },
  bar: CONFIDENCE_BAR,
  fallback: () => 'unsure',
  codeCheck: codeCheck,
  evals: 'tests/jev/evals/summarize.core.json',
  docs: '88a6a003018eaea50167565a766a0d4a91d039cf93cc7dc2965d3ceba3a72caf',
})

// Picks Jev surely calls filler give way to unpicked sentences it surely calls core;
// the picks stay when there are too few replacements.
export const followUp = (picks: ReadonlyArray<number>, verdicts: ReadonlyArray<Verdict>) => {
  const kept = picks.filter((i) => verdicts[i] !== 'filler')
  const extra = verdicts.flatMap((v, i) => (v === 'core' && !picks.includes(i) ? [i] : []))
  const out = [...kept, ...extra.slice(0, picks.length - kept.length)].sort((a, b) => a - b)
  return out.length === picks.length ? out : picks
}

// The follow-up after summarize.lead: one summarize.core call per sentence.
export const summaryFollowUp = (input: SummaryInput, picks: ReadonlyArray<number>) => {
  const n = allSentences(input.text).length
  if (n > MAX_ITEMS || picks.length >= n) return Effect.succeed(picks)
  return Effect.forEach(
    Array.from({ length: n }, (_, i) => i),
    (i) => coreDecision({ text: input.text, i }),
    { concurrency: JEV_CONCURRENCY },
  ).pipe(Effect.map((verdicts) => followUp(picks, verdicts)))
}
