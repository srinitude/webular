// SUMMARIZE accuracy eval: the rule pick (rankSpans, no Jev) against human
// reference summaries. Each case is a Wikipedia article body; its gold is the
// article's lead section, written by people to sum up that body. Scores are
// ROUGE-1 and ROUGE-2 F1 (lowercased word n-grams), averaged over articles.
import { expect, test } from 'bun:test'
import { Console, Effect } from 'effect'
import { rankSpans, sentenceSpans } from '../../src/lib/summarize-rank.ts'
import { scoreboardValue } from '../_support/scoreboard.ts'
import gold from '../fixtures/summarize-gold.json'

const r4 = (x: number) => Math.round(x * 1e4) / 1e4
const board = (metric: string) => scoreboardValue('summarize', metric)

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
// Takes the gold's grams, so the oracle builds them once per gold, not per pick.
const f1 = (pick: string, r: Map<string, number>, n: number) => {
  const p = grams(words(pick).slice(0, BUDGET), n)
  let hit = 0
  for (const [g, c] of p) hit += Math.min(c, r.get(g) ?? 0)
  return hit === 0 ? 0 : (2 * hit) / (total(p) + total(r))
}

const N = 3
const picks = () =>
  gold.articles.map((a) =>
    rankSpans(a.text, N)
      .map((s) => s.text)
      .join(' '),
  )

// Greedy extractive oracle (Nallapati et al., SummaRuNNer, 2017): add the
// source sentence that most raises ROUGE-1 F1 against the gold, N times, in
// page order under the same BUDGET. It bounds what any N-sentence extract
// can score against an abstractive lead, so it is the honest ceiling.
// ponytail: greedy, not exhaustive; it can sit a little under the true best.
const oracle = (text: string, ref: string) => {
  const all = sentenceSpans(text)
  const join = (ids: number[]) =>
    [...ids]
      .sort((a, b) => a - b)
      .map((i) => all[i]?.text ?? '')
      .join(' ')
  const refGrams = grams(words(ref), 1)
  const picked: number[] = []
  let best = 0
  while (picked.length < N) {
    let pick = -1
    for (let i = 0; i < all.length; i++) {
      if (picked.includes(i)) continue
      const f = f1(join([...picked, i]), refGrams, 1)
      if (f > best) [pick, best] = [i, f]
    }
    if (pick < 0) break
    picked.push(pick)
  }
  return best
}

// The mean ROUGE-n F1 of each 3-sentence pick against its article's gold lead.
const rouge = (summaries: string[], n: number) =>
  summaries.reduce((sum, s, i) => sum + f1(s, grams(words(gold.articles[i]?.gold ?? ''), n), n), 0) /
  summaries.length

test('summarize rule pick scores against human lead summaries', () => {
  const summaries = picks()
  const [r1, r2] = [rouge(summaries, 1), rouge(summaries, 2)]
  Effect.runSync(Console.log(`summarize ROUGE-1 F1 ${r1.toFixed(4)} ROUGE-2 F1 ${r2.toFixed(4)}`))
  expect(r1).toBeGreaterThan(0.17)
  expect(r2).toBeGreaterThan(0.04)
  expect([r4(r1), r4(r2)]).toEqual([board('ROUGE-1 F1'), board('ROUGE-2 F1')])
})

// ROUGE against human abstractive leads cannot reach 1.000 for any extract:
// the leads use words the body never has. Coverage is the share of the
// greedy oracle's ROUGE-1 that our pick reaches, per article, then averaged.
test('summarize rule pick against the extractive oracle ceiling', () => {
  const ours = picks().map((s, i) => f1(s, grams(words(gold.articles[i]?.gold ?? ''), 1), 1))
  const ceil = gold.articles.map((a) => oracle(a.text, a.gold))
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  const coverage = mean(ours.map((o, i) => Math.min(1, o / (ceil[i] || 1))))
  Effect.runSync(
    Console.log(
      `summarize ROUGE-1 ours ${mean(ours).toFixed(4)} oracle ${mean(ceil).toFixed(4)} coverage ${coverage.toFixed(4)}`,
    ),
  )
  for (const [i, c] of ceil.entries()) expect(c).toBeGreaterThanOrEqual(ours[i] ?? 0)
  expect(mean(ceil)).toBeLessThan(1)
  expect([r4(mean(ceil)), r4(coverage)]).toEqual([board('oracle ROUGE-1'), board('coverage')])
}, 30_000)

// Faithfulness: every span the pick returns is a whole source sentence,
// verbatim at its stated [start, end) offsets, in page order, no overlap.
// No model runs, so the honest target is 1.000.
test('summarize rule pick is verbatim at its offsets', () => {
  const spans = gold.articles.flatMap((a) => {
    const all = sentenceSpans(a.text)
    return rankSpans(a.text, N).map((s, k, list) => {
      const whole = all[s.index]
      const prev = list[k - 1]
      return (
        s.text.length > 0 &&
        a.text.slice(s.start, s.end) === s.text &&
        whole?.start === s.start &&
        whole?.end === s.end &&
        (prev === undefined || prev.end <= s.start)
      )
    })
  })
  const faithful = spans.filter(Boolean).length / spans.length
  Effect.runSync(
    Console.log(`summarize faithfulness ${faithful.toFixed(4)} over ${spans.length} spans`),
  )
  expect(spans.length).toBe(gold.articles.length * N)
  expect(faithful).toBe(1)
  expect(faithful).toBe(board('faithfulness') ?? -1)
})
