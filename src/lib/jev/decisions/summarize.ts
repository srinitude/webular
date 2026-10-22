// summarize: which sentence is the page's most central one? Jev picks from a
// candidate pool (summarize-pool.ts) of the whole page; its agreed pick joins the
// word-frequency summarizer's top picks; the rule alone is the fallback.
import type { JevAnswer } from '../client.ts'
import { defineDecision } from '../define.ts'
import {
  agreedPick,
  bothOrders,
  CONFIDENCE_BAR,
  choice,
  menu,
  noul,
  sureYes,
} from '../payload/index.ts'
import {
  CORE_ASK,
  CORE_PURPOSE,
  describeCore,
  EXISTS_ASK,
  LEAD_ASK,
  LEAD_PURPOSE,
} from './summarize-asks.ts'
import {
  allSentences,
  fitPool,
  poolFacts,
  sentenceFact,
  sentencePath,
  topIndexes,
} from './summarize-pool.ts'

export { allSentences, topIndexes } from './summarize-pool.ts'

export interface SummaryInput {
  readonly text: string
  readonly topN: number
}
// The picks, plus the lead Jev agreed on; the summarize workflow keeps that lead in its picks.
export interface SummaryPick {
  readonly picks: ReadonlyArray<number>
  readonly lead?: number | undefined
}
const summaryBaseline = ({ text, topN }: SummaryInput) => topIndexes(text, topN)

// Code check: indexes in range, unique, exactly min(topN, n), in text order.
const validPicks = ({ picks }: SummaryPick, { text, topN }: SummaryInput) => {
  const n = allSentences(text).length
  return (
    picks.length === Math.min(topN, n) &&
    picks.every(
      (p, i) => Number.isInteger(p) && p >= 0 && p < n && (i === 0 || p > (picks[i - 1] ?? -1)),
    )
  )
}

const leadRequest = ({ text }: SummaryInput, pool: ReadonlyArray<number>) => {
  const ids = pool.map((i) => `s${i}`)
  const describe = (k: string) =>
    k === 'none'
      ? {
          what: 'Only when every sentence is a greeting, sign-off, ad, or aside',
          not_for: 'A page where even one sentence tells a fact',
        }
      : {
          what: `Sentence \`${sentencePath(pool, Number(k.slice(1)))}\`: "${sentenceFact(text, Number(k.slice(1))).text.slice(0, 200)}"`,
        }
  return {
    state: { purpose: LEAD_PURPOSE, facts: poolFacts(text, pool) },
    // Page order, then reversed (position check); no option is put first on purpose.
    questions: {
      ...bothOrders('lead', choice(LEAD_ASK, menu(ids[0] ?? 's0', ids, describe))),
      lead_exists: noul(EXISTS_ASK),
    },
  }
}
const summaryPayload = (input: SummaryInput) =>
  leadRequest(
    input,
    fitPool(input.text, input.topN, (p) => leadRequest(input, p)),
  )

// The agreed lead joins the rule's top topN - 1; undefined lets the fallback decide.
// The lead wins over whatever the rule picks, so a re-ranked baseline never drops it.
const readSummary = (a: Record<string, JevAnswer>, t: number, input: SummaryInput) => {
  const lead = agreedPick(a, 'lead', t)
  if (lead === undefined || sureYes(a['lead_exists'], t) === false || input.topN < 1)
    return undefined
  const i = Number(lead.slice(1))
  const base = summaryBaseline(input)
  const picks = base.includes(i)
    ? base
    : [...topIndexes(input.text, input.topN - 1), i].sort((x, y) => x - y)
  return { picks, lead: i }
}

export const summaryDecision = defineDecision<SummaryInput, SummaryPick>({
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
    {
      name: 'lead_exists',
      primitive: 'noul',
      pattern: 'confidence-routing',
      payload: { question: 'lead_exists' },
    },
  ],
  payload: summaryPayload,
  read: readSummary,
  bar: CONFIDENCE_BAR,
  fallback: (input) => ({ picks: summaryBaseline(input) }),
  codeCheck: validPicks,
  evals: 'tests/jev/evals/summarize.lead.json',
  docs: '88a6a003018eaea50167565a766a0d4a91d039cf93cc7dc2965d3ceba3a72caf',
})

// Per-sentence follow-up: is sentence `i` a core point or filler? 'unsure' keeps the picks.
export type Verdict = 'core' | 'filler' | 'unsure'
interface CoreInput {
  readonly text: string
  readonly i: number
  readonly topN?: number
}
const coreKey = (i: number) => `core_s${i}`
const coreCheck = (_v: Verdict, { text, i }: CoreInput) =>
  Number.isInteger(i) && i >= 0 && i < allSentences(text).length

const coreRequest = ({ text, i }: CoreInput, pool: ReadonlyArray<number>) => ({
  state: {
    purpose: CORE_PURPOSE,
    facts: { ...poolFacts(text, pool), sentence: { id: `s${i}`, ...sentenceFact(text, i) } },
  },
  // Asked in both option orders (position check); code acts only when both agree.
  questions: bothOrders(coreKey(i), choice(CORE_ASK, menu('core', ['filler'], describeCore))),
})
const corePayload = (input: CoreInput) =>
  coreRequest(
    input,
    fitPool(input.text, input.topN ?? 1, (p) => coreRequest(input, p), [input.i]),
  )

export const coreDecision = defineDecision<CoreInput, Verdict>({
  name: 'summarize.core',
  sample: () => ({
    text: 'Hello and welcome, friends of Bun! Bun ships a built-in SQLite driver called bun:sqlite.',
    i: 0,
  }),
  subtasks: [
    { name: 'core', primitive: 'choice', pattern: 'fan-out', payload: { question: coreKey(0) } },
  ],
  payload: corePayload,
  read: (a, t, input) => {
    const v = agreedPick(a, coreKey(input.i), t)
    return v === 'core' || v === 'filler' ? v : undefined
  },
  bar: CONFIDENCE_BAR,
  fallback: () => 'unsure',
  codeCheck: coreCheck,
  evals: 'tests/jev/evals/summarize.core.json',
  docs: '88a6a003018eaea50167565a766a0d4a91d039cf93cc7dc2965d3ceba3a72caf',
})
