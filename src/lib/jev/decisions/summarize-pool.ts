// The candidate pool for summarize's Jev questions: the frequency rule's top
// max(40, 4 × asked) sentences plus s0, the rule's picks, and any sentence a
// question names, in page order. Ids are page positions (`s35` is sentence 36).
import { summarizeText } from '../../summarize.ts'
import { JEV_MODEL_DEFAULT, type JevRequest } from '../client.ts'
import { batches, CAPS, JEV_TOKEN_CAP, payloadTokens, requestBytes } from '../payload/index.ts'

const MAX_SENTENCE = 600

// Every sentence of `text` in text order, split the way summarizeText splits it.
export const allSentences = (text: string) =>
  summarizeText(text, Number.POSITIVE_INFINITY).sentences

// Indexes of the summarizer's top `topN` sentences, in text order.
export const topIndexes = (text: string, topN: number): ReadonlyArray<number> => {
  const all = allSentences(text)
  const used = new Set<number>()
  for (const s of summarizeText(text, topN).sentences) {
    const i = all.findIndex((t, j) => t === s && !used.has(j))
    if (i >= 0) used.add(i)
  }
  return [...used].sort((a, b) => a - b)
}

export const poolSize = (topN: number) => Math.max(40, 4 * topN)

// s0, the rule's picks, and `keep` always stay; the rest are the top `size` by rank.
export const candidatePool = (
  text: string,
  topN: number,
  size: number = poolSize(topN),
  keep: ReadonlyArray<number> = [],
): ReadonlyArray<number> => {
  const n = allSentences(text).length
  const ids = new Set([0, ...keep, ...topIndexes(text, topN), ...topIndexes(text, size)])
  return [...ids].filter((i) => Number.isInteger(i) && i >= 0 && i < n).sort((a, b) => a - b)
}

// The largest pool whose request fits Jev's 32k-token cap; past it the
// lowest-ranked sentences go first, never s0, the rule's picks, or `keep`.
// ponytail: one rebuild per dropped sentence, O(pool) builds; binary search if pages grow.
export const fitPool = (
  text: string,
  topN: number,
  build: (pool: ReadonlyArray<number>) => JevRequest,
  keep: ReadonlyArray<number> = [],
): ReadonlyArray<number> => {
  const fits = (p: ReadonlyArray<number>) => {
    const r = build(p)
    return payloadTokens(requestBytes(JEV_MODEL_DEFAULT, r.state, r.questions)) <= JEV_TOKEN_CAP
  }
  for (let size = poolSize(topN); size > 0; size--) {
    const pool = candidatePool(text, topN, size, keep)
    if (fits(pool)) return pool
  }
  return candidatePool(text, topN, 0, keep)
}

// State keeps at most CAPS.fields keys per object, so the pool goes in parts of 20.
const part = (pool: ReadonlyArray<number>, i: number) =>
  `part_${Math.floor(pool.indexOf(i) / CAPS.fields) + 1}`
export const sentencePath = (pool: ReadonlyArray<number>, i: number) =>
  `facts.pool.sentences.${part(pool, i)}.s${i}`

const entry = (all: ReadonlyArray<string>, i: number) => ({
  text: (all[i] ?? '').slice(0, MAX_SENTENCE),
  place: `${i + 1} of ${all.length}`,
})
export const sentenceFact = (text: string, i: number) => entry(allSentences(text), i)

// facts.page and facts.pool for one request, every sentence with its text and place.
export const poolFacts = (text: string, pool: ReadonlyArray<number>) => {
  const all = allSentences(text)
  const parts = batches([...pool]).map((ids, k) => [
    `part_${k + 1}`,
    Object.fromEntries(ids.map((i) => [`s${i}`, entry(all, i)])),
  ])
  return {
    page: { title: '', sentence_count: all.length },
    pool: {
      how_built:
        'These are the sentences most likely to matter, taken from the whole page. They are in page order.',
      sentences: Object.fromEntries(parts),
    },
  }
}
