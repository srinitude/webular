// Per-family paired scoring (spec-grading-and-stats.md, Statistics and Keep
// and win rules): webular against each peer on the tasks both scored, one
// Holm family across every test, and one headline per family over the tasks
// every arm offering it scored, so arms with different supported sets never
// meet on raw accuracy and families with different units are never averaged.
import type { Comparison, Family } from '../schema.ts'
import { draft, finalize, type Pair } from '../stats.ts'
import type { Job, RunRecord } from './model.ts'
import { sharedTasks } from './score.ts'

// The stats family each peer job stands in for; the report prints the job.
const FAMILY = { search: 'search.known-item', answer: 'answer.short' } as const
const JOBS = Object.keys(FAMILY) as (keyof typeof FAMILY)[]
const SEED = 1

interface Cell {
  sum: number
  n: number
  err: boolean
}

// Per task: mean accuracy over scored runs, and whether any run errored.
const byTask = (records: readonly RunRecord[], id: string) => {
  const m = new Map<string, Cell>()
  for (const r of records) {
    if (r.provider !== id || (r.status !== 'ok' && r.status !== 'error')) continue
    const c = m.get(r.task) ?? { sum: 0, n: 0, err: false }
    m.set(r.task, {
      sum: c.sum + (r.metrics['accuracy'] ?? 0),
      n: c.n + 1,
      err: c.err || r.status === 'error',
    })
  }
  return m
}

const score = (c: Cell | undefined) => (c && c.n > 0 ? c.sum / c.n : 0)

// Sorted by task id so a score never depends on the order rows arrived in.
export const pairsFor = (records: readonly RunRecord[], peer: string, job: Job): Pair[] => {
  const rows = records.filter((r) => r.job === job)
  const shared = [...sharedTasks(rows, ['webular', peer])].toSorted()
  const a = byTask(rows, 'webular')
  const b = byTask(rows, peer)
  return shared.map((t) => ({
    a: score(a.get(t)),
    b: score(b.get(t)),
    errA: a.get(t)?.err ?? false,
    errB: b.get(t)?.err ?? false,
  }))
}

const graded = (pairs: readonly Pair[]) =>
  pairs.some((p) => !Number.isInteger(p.a) || !Number.isInteger(p.b))

const notOffered = (family: Family, peer: string): Comparison => ({
  family,
  peer,
  n: 0,
  diff: 0,
  ci: [0, 0],
  test: 'exact McNemar',
  p: 1,
  pHolm: 1,
  verdict: 'not offered',
})

// Empty cells stay out of the Holm family and report as not offered.
export const familyComparisons = (
  records: readonly RunRecord[],
  peers: readonly string[],
): Comparison[] => {
  const cells = peers.flatMap((peer) =>
    JOBS.map((job) => ({ family: FAMILY[job], peer, pairs: pairsFor(records, peer, job) })),
  )
  const live = cells.filter((c) => c.pairs.length > 0)
  const drafts = live.map((c) =>
    draft(c.family, c.peer, c.pairs, { graded: graded(c.pairs), seed: SEED }),
  )
  const empty = cells.filter((c) => c.pairs.length === 0)
  return [...finalize(drafts), ...empty.map((c) => notOffered(c.family, c.peer))]
}

// One family's accuracy per arm, over only the tasks every arm offering the
// family scored; an arm that scored none of the family is left out.
export const sharedHeadline = (records: readonly RunRecord[], ids: readonly string[], job: Job) => {
  const rows = records.filter((r) => r.job === job)
  const cells = ids.map((id) => [id, byTask(rows, id)] as const).filter(([, m]) => m.size > 0)
  const shared = [
    ...sharedTasks(
      rows,
      cells.map(([id]) => id),
    ),
  ]
  const accuracy: Record<string, number> = {}
  for (const [id, m] of cells)
    accuracy[id] = shared.reduce((s, t) => s + score(m.get(t)), 0) / shared.length
  return { job, n: shared.length, accuracy }
}

const fmt = (n: number | undefined) =>
  n === undefined || Number.isNaN(n) ? 'n/a' : Number(n.toPrecision(3)).toString()

const headlineLine = (records: readonly RunRecord[], ids: readonly string[], job: Job) => {
  const h = sharedHeadline(records, ids, job)
  const arms = Object.entries(h.accuracy).map(([id, v]) => `${id} ${fmt(v)}`)
  return `  ${job} on the ${h.n} tasks every arm offering it scored: ${arms.join(', ') || 'none'}`
}

const comparisonLine = (c: Comparison) =>
  [
    c.family.split('.')[0],
    c.peer,
    `n=${c.n}`,
    `diff=${fmt(c.diff)}`,
    `ci=[${fmt(c.ci[0])}, ${fmt(c.ci[1])}]`,
    c.test,
    `p=${fmt(c.p)}`,
    `pHolm=${fmt(c.pHolm)}`,
    c.verdict,
  ].join('  ')

export const renderFamilies = (records: readonly RunRecord[], peers: readonly string[]): string =>
  [
    '== headline accuracy per family, shared tasks only ==',
    ...JOBS.map((job) => headlineLine(records, ['webular', ...peers], job)),
    '== per-family paired tests, webular vs peer (Holm across all) ==',
    ...familyComparisons(records, peers).map((c) => `  ${comparisonLine(c)}`),
  ].join('\n')
