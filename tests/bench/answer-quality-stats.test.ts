// Small-sample intervals, closed-book ratio, kappa marginals, and the small-n
// note in the results section.
import { expect, test } from 'bun:test'
import { kappaReport } from '../../scripts/bench/agreement.ts'
import { answerSplit, type FamilyResult, results } from '../../scripts/bench/report-parts.ts'
import type { Comparison } from '../../scripts/bench/schema.ts'
import { wilsonCI } from '../../scripts/bench/stats.ts'

test('wilsonCI gives a bounded interval for small n', () => {
  expect(wilsonCI(0, 0)).toEqual([0, 1])
  const [lo, hi] = wilsonCI(5, 10)
  expect(lo).toBeCloseTo(0.2366, 3)
  expect(hi).toBeCloseTo(0.7634, 3)
  const [allLo, allHi] = wilsonCI(10, 10)
  expect(allLo).toBeCloseTo(0.7225, 3)
  expect(allHi).toBe(1)
})

test('answer split shows the native answer as a ratio to closed book', () => {
  const row = { tool: 't', retrieval: 0.5, fixedReader: 0.5, nativeAnswer: 0.6, memory: 0 }
  const md = answerSplit([
    { ...row, closedBook: 0.4 },
    { ...row, tool: 'u', closedBook: 0 },
  ])
  expect(md).toContain('native / closed book')
  expect(md).toContain('| 1.50 |')
  expect(md).toMatch(/\| u \|.*\| n\/a \|/)
})

test('kappaReport carries raw agreement and each rater marginal', () => {
  const r = kappaReport(['y', 'y', 'n', 'n'], ['y', 'n', 'n', 'n'])
  expect(r.observed).toBe(0.75)
  expect(r.kappa).toBeCloseTo(0.5, 9)
  expect(r.marginalsA).toEqual({ y: 0.5, n: 0.5 })
  expect(r.marginalsB).toEqual({ y: 0.25, n: 0.75 })
})

const base = {
  family: 'search',
  tool: 'peer',
  n: 8,
  score: 0.5,
  ci: [0.2, 0.8],
  errorRate: 0,
  costPerCorrect: null,
  webularOnly: false,
} as unknown as FamilyResult

test('results say when n is too small for significance', () => {
  const comparison = {
    family: base.family,
    peer: 'peer',
    n: 8,
    diff: 0.1,
    ci: [-0.2, 0.4],
    test: 'exact McNemar',
    p: 0.5,
    pHolm: 0.5,
    verdict: 'not enough tasks',
  } as unknown as Comparison
  expect(results([{ ...base, comparison }])).toContain('too few tasks for significance')
  expect(results([base])).not.toContain('too few tasks for significance')
})
