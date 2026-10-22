// Extractive pick for the summarize command: verbatim sentences with offsets,
// chosen by MMR over a relevance score with a lead and section-lead prior.
import { type Spans, scores, splitSentences, type TokenIds, tokenIds } from './summarize.ts'

// One verbatim sentence: its page-order index and [start, end) offsets into
// the text it was cut from.
export interface Span {
  index: number
  start: number
  end: number
  text: string
}

const toSpan = (text: string, spans: Spans, i: number): Span => {
  const start = spans.starts[i] ?? 0
  const end = spans.ends[i] ?? 0
  return { index: i, start, end, text: text.slice(start, end) }
}

// Every sentence of `text` in page order, split the way summarizeText splits it.
export const sentenceSpans = (text: string): Span[] => {
  const spans = splitSentences(text)
  return spans.starts.map((_, i) => toSpan(text, spans, i))
}

// A line with no closing punctuation and few words reads as a heading; the
// sentence after it opens a section.
const isHeading = (s: string, words: number) => words > 0 && words <= 10 && !/[.!?:;,]$/.test(s)

// Relevance: mean word frequency, damped for fragments under SHORT words,
// plus a position prior for the page lead and each section lead.
const SHORT = 6
function relevance(text: string, spans: Spans, t: TokenIds): Float64Array {
  const base = scores(t)
  const out = new Float64Array(base.length)
  for (let i = 0; i < out.length; i++) {
    const words = (t.offsets[i + 1] ?? 0) - (t.offsets[i] ?? 0)
    const prev = i > 0 ? text.slice(spans.starts[i - 1], spans.ends[i - 1]) : ''
    const wordsBefore = i > 0 ? (t.offsets[i] ?? 0) - (t.offsets[i - 1] ?? 0) : 0
    const sectionLead = isHeading(prev, wordsBefore) ? 0.05 : 0
    out[i] = (base[i] ?? 0) * Math.min(1, words / SHORT) + 0.1 / (1 + i) + sectionLead
  }
  return out
}

// Cosine similarity of two sentences' distinct word ids.
function cosine(a: Set<number> | undefined, b: Set<number> | undefined): number {
  if (!a?.size || !b?.size) return 0
  let shared = 0
  for (const id of a) if (b.has(id)) shared++
  return shared / Math.sqrt(a.size * b.size)
}

// Maximal marginal relevance: each pick trades relevance against its
// likeness to what is already picked; a near-duplicate is never picked.
const LAMBDA = 0.7
const NEAR_DUPLICATE = 0.8
function mmr(
  rel: Float64Array,
  sets: Map<number, Set<number>>,
  pool: number[],
  topN: number,
  picked: number[],
): number[] {
  while (picked.length < topN) {
    let best = -1
    let bestScore = Number.NEGATIVE_INFINITY
    for (const i of pool) {
      if (picked.includes(i)) continue
      const like = picked.reduce((m, j) => Math.max(m, cosine(sets.get(i), sets.get(j))), 0)
      const score = LAMBDA * (rel[i] ?? 0) - (1 - LAMBDA) * like
      if (like < NEAR_DUPLICATE && score > bestScore) [best, bestScore] = [i, score]
    }
    if (best < 0) break
    picked.push(best)
  }
  return picked
}

// The summarize command's rule pick: top `topN` sentences by MMR over a
// relevance-ranked pool, returned in page order. Deterministic: ties keep
// page order. `pin`, a sentence index, is always picked. ponytail: pool of
// 4 * topN (at least 50) bounds the O(pool * topN) scan.
export function rankSpans(text: string, topN: number, pin?: number): Span[] {
  const spans = splitSentences(text)
  const t = tokenIds(text, spans)
  const rel = relevance(text, spans, t)
  const pool = Array.from(rel, (_, i) => i)
    .sort((a, b) => (rel[b] ?? 0) - (rel[a] ?? 0))
    .slice(0, Math.max(50, topN * 4))
  const picked = pin !== undefined && pin < rel.length && topN > 0 ? [pin] : []
  const sets = new Map(
    [...pool, ...picked].map((i) => [i, new Set(t.ids.slice(t.offsets[i], t.offsets[i + 1]))]),
  )
  return mmr(rel, sets, pool, topN, picked)
    .sort((a, b) => a - b)
    .map((i) => toSpan(text, spans, i))
}
