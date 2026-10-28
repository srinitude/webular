// search --why card: each result shows its raw fused score, the score's parts,
// and a word tied to a code threshold, under a label that the scores compare
// results in this run only; the card ends in a verdict and a next command.
import { describe, expect, test } from 'bun:test'
import { SCORE_LABEL, WEAK_AT, whyBlock, withWhy } from '../../src/cli/why.ts'
import { WEAK_SCORE } from '../../src/lib/search.ts'
import { hitScore, scoresOf, scoreWord } from '../../src/lib/search-score-word.ts'

type Place = [number, number]
const hit = (url: string) => ({ title: url, url, description: '' })
const top = {
  hit: hit('https://bun.sh/'),
  score: 0.0412,
  lists: [0, 2],
  rank: 1,
  places: [[0, 1] as Place, [2, 3] as Place],
  signal: 0.01,
}
const low = {
  hit: hit('https://x.dev/'),
  score: 0.02,
  lists: [1],
  rank: 2,
  places: [[1, 1] as Place],
}
const ran = ['brave', 'npm', 'exa'].map((source) => ({ source, lists: [[]] }))

describe('search --why score words', () => {
  test('words follow the code thresholds: weak under 1.5/61, clear lead, else backed', () => {
    expect(WEAK_SCORE).toBeCloseTo(1.5 / 61, 10)
    expect(WEAK_AT).toBe(WEAK_SCORE.toFixed(4))
    expect(scoreWord(1 / 61, false)).toBe('weak')
    expect(scoreWord(WEAK_SCORE, false)).toBe('backed')
    expect(scoreWord(2 / 61, false)).toBe('backed')
    expect(scoreWord(1 / 61, true)).toBe('clear lead')
  })

  test('each hit: raw score, one part per list rank, the domain sign, and its word', () => {
    expect(hitScore(top, ['brave', 'npm', 'exa'], true)).toEqual({
      url: 'https://bun.sh/',
      score: 0.0412,
      parts: ['brave#1', 'exa#3', '+official'],
      word: 'clear lead',
    })
    const aggregator = hitScore({ ...top, signal: -0.01 }, ['brave'], false)
    expect(aggregator.parts).toEqual(['brave#1', 'list#3', '-aggregator'])
  })

  test('only the fused top hit with two lists and a 1/61 lead is a clear lead', () => {
    const out = scoresOf([low.hit, top.hit], [top, low], ran)
    expect(out.map((s) => [s.url, s.word, s.parts])).toEqual([
      ['https://x.dev/', 'weak', ['npm#1']],
      ['https://bun.sh/', 'clear lead', ['brave#1', 'exa#3', '+official']],
    ])
    const close = { ...low, score: 0.035 }
    expect(scoresOf([top.hit], [top, close], ran)[0]?.word).toBe('backed')
  })
})

const recorded = {
  query: 'bun runtime',
  count: 2,
  results: [hit('https://openalex.org/W1'), hit('https://doi.org/10.5281/zenodo.7945165')],
  meta: { sources: { openalex: { status: 'ok', ms: 5 } }, degraded: false, weak: false },
}
const scores = [
  {
    url: 'https://openalex.org/W1',
    score: 0.0412,
    parts: ['openalex#1', 'wikipedia#3', '+official'],
    word: 'clear lead',
  },
  {
    url: 'https://doi.org/10.5281/zenodo.7945165',
    score: 0.0164,
    parts: ['openalex#2'],
    word: 'weak',
  },
]
const card = (meta: Record<string, unknown>) =>
  whyBlock(withWhy('search', { ...recorded, meta: { ...recorded.meta, ...meta } })).split('\n')

describe('search --why card', () => {
  test('the label, then each result with raw score, parts, and word', () => {
    expect(SCORE_LABEL).toBe('Scores compare results in this run only.')
    expect(card({ scores }).slice(1, 5)).toEqual([
      'Why these results:',
      SCORE_LABEL,
      '1. openalex.org 0.0412 openalex#1 wikipedia#3 +official (clear lead)',
      '2. doi.org 0.0164 openalex#2 (weak)',
    ])
  })

  test('ends in a verdict and a next command: scrape the top page, or research when weak', () => {
    expect(card({ scores }).slice(-2)).toEqual([
      `Verdict: not weak. The top fused hit scored ${WEAK_AT} or more.`,
      'Next: webular scrape https://openalex.org/W1',
    ])
    expect(card({ weak: true }).slice(-2)).toEqual([
      `Verdict: weak. The top fused hit scored under ${WEAK_AT}.`,
      'Next: webular research "bun runtime"',
    ])
    expect(whyBlock(withWhy('parse', {}))).not.toContain('Verdict')
  })
})
