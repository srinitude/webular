// Paired statistics (spec-grading-and-stats.md, Statistics and Keep and win
// rules; audit findings 5 and 6). Every comparison is paired by task,
// intervals come from a task-level bootstrap, and a verdict needs a
// Holm-adjusted test, a CI that excludes zero, and enough tasks.
import type { Comparison, Family, Verdict } from './schema.ts'

// One task's paired outcome: a = webular, b = peer. Scores are 0/1 for
// pass/fail families. A failed row (empty, timeout, error_*) scores 0.
export interface Pair {
  readonly a: number
  readonly b: number
  readonly errA: boolean
  readonly errB: boolean
  readonly group?: string | undefined
}

const ALPHA = 0.05
const MIN_GAP = 0.05
const RESAMPLES = 10_000

// Seeded PRNG (mulberry32) so every interval and p value replays exactly.
const prng = (seed: number): (() => number) => {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const mean = (xs: readonly number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length

const quantile = (sorted: readonly number[], q: number): number =>
  sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * sorted.length)))] ?? 0

// Sum and count of a - b per task group (each ungrouped task is its own group).
const clusters = (pairs: readonly Pair[]): { sums: Float64Array; counts: Float64Array } => {
  const byGroup = new Map<string, { sum: number; count: number }>()
  pairs.forEach((p, i) => {
    const key = p.group ?? `task:${i}`
    const g = byGroup.get(key) ?? { sum: 0, count: 0 }
    byGroup.set(key, { sum: g.sum + p.a - p.b, count: g.count + 1 })
  })
  const groups = [...byGroup.values()]
  return {
    sums: Float64Array.from(groups, (g) => g.sum),
    counts: Float64Array.from(groups, (g) => g.count),
  }
}

// Paired bootstrap 95% CI of mean(a - b), resampling task groups when given.
export const bootstrapCI = (
  pairs: readonly Pair[],
  seed: number,
  resamples = RESAMPLES,
): readonly [number, number] => {
  const { sums, counts } = clusters(pairs)
  const k = counts.length
  if (k === 0) return [0, 0]
  const rand = prng(seed)
  const means = new Float64Array(resamples)
  for (let r = 0; r < resamples; r++) {
    let sum = 0
    let count = 0
    for (let j = 0; j < k; j++) {
      const g = Math.floor(rand() * k)
      sum += sums[g] ?? 0
      count += counts[g] ?? 0
    }
    means[r] = sum / count
  }
  means.sort()
  return [quantile([...means], 0.025), quantile([...means], 0.975)]
}

const logChoose = (n: number, k: number): number => {
  let s = 0
  for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i)
  return s
}

// Exact two-sided McNemar: binomial(n = b + c, 0.5) on the discordant pairs.
export const mcnemarExact = (b: number, c: number): number => {
  const n = b + c
  if (n === 0) return 1
  let tail = 0
  for (let k = 0; k <= Math.min(b, c); k++) tail += Math.exp(logChoose(n, k) - n * Math.LN2)
  return Math.min(1, 2 * tail)
}

// Paired permutation (sign-flip) test on mean(a - b), two-sided.
const permutationTest = (
  pairs: readonly Pair[],
  seed: number,
  permutations = RESAMPLES,
): number => {
  const diffs = pairs.map((p) => p.a - p.b)
  const observed = Math.abs(mean(diffs))
  const rand = prng(seed)
  let extreme = 0
  for (let r = 0; r < permutations; r++) {
    let sum = 0
    for (const d of diffs) sum += rand() < 0.5 ? -d : d
    if (Math.abs(sum / diffs.length) >= observed - 1e-12) extreme++
  }
  return (extreme + 1) / (permutations + 1)
}

// Holm step-down adjustment; results come back in input order.
export const holm = (ps: readonly number[]): number[] => {
  const order = ps.map((p, i) => ({ p, i })).sort((x, y) => x.p - y.p)
  const out = new Array<number>(ps.length).fill(1)
  let running = 0
  order.forEach(({ p, i }, rank) => {
    running = Math.max(running, Math.min(1, (ps.length - rank) * p))
    out[i] = running
  })
  return out
}

// Tasks needed for 80% power on a paired binary test at the smallest gap d,
// given the discordant-pair proportion pd.
export const requiredTasks = (pd: number, d = MIN_GAP): number =>
  (1.96 * Math.sqrt(pd) + 0.84 * Math.sqrt(Math.max(0, pd - d * d))) ** 2 / (d * d)

interface Draft extends Omit<Comparison, 'pHolm' | 'verdict'> {
  readonly pd: number
  readonly errA: number
  readonly errB: number
}

const rate = (xs: readonly boolean[]): number => mean(xs.map((x) => (x ? 1 : 0)))

export const draft = (
  family: Family,
  peer: string,
  pairs: readonly Pair[],
  opts: { readonly graded: boolean; readonly seed: number },
): Draft => {
  const b = pairs.filter((p) => p.a > p.b).length
  const c = pairs.filter((p) => p.a < p.b).length
  return {
    family,
    peer,
    n: pairs.length,
    diff: mean(pairs.map((p) => p.a - p.b)),
    ci: bootstrapCI(pairs, opts.seed),
    test: opts.graded ? 'paired permutation' : 'exact McNemar',
    p: opts.graded ? permutationTest(pairs, opts.seed) : mcnemarExact(b, c),
    pd: pairs.length === 0 ? 0 : (b + c) / pairs.length,
    errA: rate(pairs.map((p) => p.errA)),
    errB: rate(pairs.map((p) => p.errB)),
  }
}

const verdictOf = (d: Draft, pHolm: number, minGap = MIN_GAP): Verdict => {
  if (d.n === 0 || d.n < requiredTasks(d.pd, minGap)) return 'not enough tasks'
  if (pHolm < ALPHA && d.ci[0] > 0 && d.errA <= d.errB + 0.01) return 'win'
  if (pHolm < ALPHA && d.ci[1] < 0 && d.errB <= d.errA + 0.01) return 'loss'
  return 'tie'
}

// One report's family of tests: Holm across all of them, then verdicts.
export const finalize = (drafts: readonly Draft[], minGap = MIN_GAP): Comparison[] => {
  const adjusted = holm(drafts.map((d) => d.p))
  return drafts.map((d, i) => {
    const pHolm = adjusted[i] ?? 1
    const { family, peer, n, diff, ci, test, p } = d
    return { family, peer, n, diff, ci, test, p, pHolm, verdict: verdictOf(d, pHolm, minGap) }
  })
}
