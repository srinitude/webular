// Extractive summarize contract: picks are verbatim spans of the source,
// near-duplicates give way (MMR), the lead wins ties, and the split knows
// common abbreviations.
import { describe, expect, test } from 'bun:test'
import { rankSpans, sentenceSpans } from '../../src/lib/summarize-rank.ts'

const PAGE = [
  'Bun ships a fast SQLite driver built into the runtime.',
  'Bun ships a fast SQLite driver built into the runtime today.',
  'The driver runs prepared statements and returns plain objects.',
  'Bun also bundles a test runner that reads Jest style files.',
  'Thanks for reading!',
].join(' ')
const TIED = 'Alpha beta gamma delta. Epsilon zeta theta iota. Kappa lambda omicron sigma.'
const MESSY = `  Lead line here.\n\nDr. Smith met the U.S. team. ${PAGE}  `

describe('rankSpans — extractive picks', () => {
  test('offsets point at the exact source text', () => {
    for (const p of rankSpans(MESSY, 4)) expect(MESSY.slice(p.start, p.end)).toBe(p.text)
    for (const p of sentenceSpans(MESSY)) expect(MESSY.slice(p.start, p.end)).toBe(p.text)
  })
  test('MMR drops near-duplicate sentences', () => {
    const texts = rankSpans(PAGE, 3).map((p) => p.text)
    expect(texts.filter((t) => t.startsWith('Bun ships a fast SQLite'))).toHaveLength(1)
  })
  test('the lead is preferred when scores tie', () => {
    expect(rankSpans(TIED, 1).map((p) => p.index)).toEqual([0])
  })
  test('picks come back in page order', () => {
    const order = rankSpans(PAGE, 3).map((p) => p.index)
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })
  test('abbreviations do not end a sentence', () => {
    const texts = sentenceSpans('Dr. Smith met the U.S. team. They talked.').map((p) => p.text)
    expect(texts).toEqual(['Dr. Smith met the U.S. team.', 'They talked.'])
  })
  test('the same input gives the same picks', () => {
    expect(rankSpans(PAGE, 3)).toEqual(rankSpans(PAGE, 3))
  })
})
