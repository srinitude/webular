// SUMMARIZE accuracy eval: the rule pick (rankSpans, no Jev) against human
// reference summaries. Each case is a Wikipedia article body; its gold is the
// article's lead section, written by people to sum up that body. Scores are
// ROUGE-1 and ROUGE-2 F1 (lowercased word n-grams), averaged over articles.
import { expect, test } from 'bun:test'
import { Console, Effect } from 'effect'
import { rankSpans } from '../../src/lib/summarize-rank.ts'
import gold from '../fixtures/summarize-gold.json'

const words = (s: string) => s.toLowerCase().match(/[a-z0-9]+/g) ?? []
const grams = (w: string[], n: number) => {
  const m = new Map<string, number>()
  for (let i = 0; i + n <= w.length; i++) {
    const g = w.slice(i, i + n).join(' ')
    m.set(g, (m.get(g) ?? 0) + 1)
  }
  return m
}
// DUC-style length limit: every pick is cut to BUDGET words, so a longer
// pick cannot win on length alone.
const BUDGET = 75
const total = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0)
const f1 = (pick: string, ref: string, n: number) => {
  const [p, r] = [grams(words(pick).slice(0, BUDGET), n), grams(words(ref), n)]
  let hit = 0
  for (const [g, c] of p) hit += Math.min(c, r.get(g) ?? 0)
  return hit === 0 ? 0 : (2 * hit) / (total(p) + total(r))
}

const picks = () =>
  gold.articles.map((a) =>
    rankSpans(a.text, 3)
      .map((s) => s.text)
      .join(' '),
  )

// The mean ROUGE-n F1 of each 3-sentence pick against its article's gold lead.
const rouge = (summaries: string[], n: number) =>
  summaries.reduce((sum, s, i) => sum + f1(s, gold.articles[i]?.gold ?? '', n), 0) /
  summaries.length

test('summarize rule pick scores against human lead summaries', () => {
  const summaries = picks()
  const [r1, r2] = [rouge(summaries, 1), rouge(summaries, 2)]
  Effect.runSync(
    Console.log(
      `summarize ROUGE-1 F1 ${r1.toFixed(4)} ROUGE-2 F1 ${r2.toFixed(4)}`,
    ),
  )
  expect(r1).toBeGreaterThan(0.17)
  expect(r2).toBeGreaterThan(0.04)
})
