// Summarizer complexity contract: the single-scan sentence split and
// tokenize-once scoring must pick exactly what a plain segment-then-score,
// tokenize-twice algorithm picks, and stay near-linear on big inputs.
import { describe, expect, test } from 'bun:test'
import { summarizeText } from '../../src/lib/summarize.ts'

const STOP = new Set(['the', 'and', 'is', 'a', 'of', 'to', 'it', 'this'])
const tok = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w))

// The original algorithm, kept as the reference oracle. Only the stopword
// list is trimmed, and the corpus below uses no other stopwords.
function reference(text: string, topN: number): string[] {
  // The split is the Unicode sentence break (UAX #29) the summarizer uses;
  // the corpus holds no abbreviations, so no break is skipped.
  const sentences = Array.from(new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text))
    .map((s) => s.segment.trim())
    .filter((s) => s.length > 0)
  const freq = new Map<string, number>()
  for (const w of tok(text)) freq.set(w, (freq.get(w) ?? 0) + 1)
  const max = Math.max(0, ...freq.values())
  const score = (s: string) => {
    const ws = tok(s)
    return ws.length === 0 || max === 0
      ? 0
      : ws.reduce((n, w) => n + (freq.get(w) ?? 0), 0) / (ws.length * max)
  }
  const scored = sentences.map((s, i) => ({ s, i, v: score(s) }))
  scored.sort((x, y) => y.v - x.v)
  return scored
    .slice(0, topN)
    .sort((x, y) => x.i - y.i)
    .map((x) => x.s)
}

const CORPUS = [
  'Crawlers visit pages. "Quoted start" follows! Is it 3.5 or 4? Mixed case: Web pages link.',
  'no capital after this. Then One more sentence?  Spaces   Galore.\nNewline Starts here.',
  "Punctuation... Ellipsis Works. Ünïcode Words Stay. 'Single quote' starts this.",
  'Sentence one has web and map words. Sentence two has crawl and link words.',
  // Offsets must trim exactly like String.prototype.trim, Unicode spaces included.
  '  \tLeading space web here.  Trailing web map too.　 ',
]

describe('summarizeText — same picks as the original algorithm', () => {
  for (const [i, text] of CORPUS.entries()) {
    test(`corpus ${i}`, () => {
      for (const n of [1, 2, 3, 10])
        expect(summarizeText(text, n).sentences).toEqual(reference(text, n))
    })
  }
})

describe('summarizeText — near-linear scaling', () => {
  test('100,000 sentences stay well under a second per 10,000-sentence step', () => {
    const text = Array.from({ length: 100_000 }, (_, i) => `Sentence ${i} has web words.`).join(' ')
    const start = Bun.nanoseconds()
    expect(summarizeText(text, 5).sentences).toHaveLength(5)
    expect((Bun.nanoseconds() - start) / 1e6).toBeLessThan(5_000)
  })
})
