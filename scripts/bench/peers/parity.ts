// Command parity: for each command in docs/command-parity.md's "Commands with a
// rival" table, the committed peer run must show a pass or the ceilings file
// must hold a written ceiling with evidence. Pass = webular accuracy at least
// the best of Exa, Tavily, Firecrawl, and Perplexity on shared tasks, and
// webular p50 within max(2 x bootstrap SE, 10 ms) of the best rival p50.
// tests/bench/command-parity.test.ts runs it in the default test path.
import { Effect, FileSystem, Schema } from 'effect'
import { bootstrapCI } from '../stats.ts'
import { pickRun } from './docs.ts'
import type { Row } from './report.ts'
import { percentile, sharedTasks } from './score.ts'
import { censoredLatencies } from './timeout.ts'

export const RIVALS = ['exa', 'tavily', 'firecrawl', 'perplexity'] as const
const NOISE_FLOOR_MS = 10
const SEED = 1

export const Ceiling = Schema.Struct({
  command: Schema.String,
  reason: Schema.NonEmptyString,
  evidence: Schema.NonEmptyString,
})
export type Ceiling = typeof Ceiling.Type

export interface Verdict {
  command: string
  result: 'pass' | 'ceiling' | 'fail'
  detail: string
}

// The command column of the "Commands with a rival" table, in document order.
export const mappedCommands = (doc: string): string[] => {
  const section = doc.split(/^## /m).find((s) => s.startsWith('Commands with a rival')) ?? ''
  return [...section.matchAll(/^\| `([a-z]+)` \|/gm)].flatMap((m) => m[1] ?? [])
}

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

// Repeats flagged `cached` (cache.ts) stay out: the headline uses cold numbers
// only (bench/spec/spec-grading-and-stats.md, "Cache detection").
const scoredBy = (rows: readonly Row[], id: string, tasks: ReadonlySet<string>) =>
  rows.filter(
    (r) =>
      r.provider === id &&
      tasks.has(r.task) &&
      r.cached !== true &&
      (r.status === 'ok' || r.status === 'error'),
  )

// Webular against one rival on the tasks both scored; undefined when none are shared.
const against = (rows: readonly Row[], rival: string) => {
  const shared = sharedTasks(rows, ['webular', rival])
  if (shared.size === 0) return undefined
  const acc = (id: string) =>
    mean(scoredBy(rows, id, shared).map((r) => r.metrics['accuracy'] ?? 0))
  const p50 = (id: string) => percentile(censoredLatencies(scoredBy(rows, id, shared)), 50) ?? 0
  // Per shared task: the mean latency of each arm, failures censored at the timeout.
  const taskMs = (id: string, t: string) =>
    mean(censoredLatencies(scoredBy(rows, id, new Set([t]))))
  const pairs = [...shared].toSorted().map((t) => ({
    a: taskMs('webular', t),
    b: taskMs(rival, t),
    errA: false,
    errB: false,
  }))
  // ponytail: SE of the mean per-task latency gap stands in for the p50 gap's SE;
  // bootstrap p50 itself if the two ever disagree on a verdict.
  const [lo, hi] = bootstrapCI(pairs, SEED)
  const se = (hi - lo) / (2 * 1.96)
  return {
    rival,
    n: shared.size,
    accGap: acc('webular') - acc(rival),
    p50Gap: p50('webular') - p50(rival),
    bar: Math.max(2 * se, NOISE_FLOOR_MS),
  }
}

// One command's verdict from the run's records of that job and the ceilings.
export const verdictFor = (
  command: string,
  records: readonly Row[],
  ceilings: readonly Ceiling[],
): Verdict => {
  const rows = records.filter((r) => r.job === command)
  const cmp = RIVALS.flatMap((r) => against(rows, r) ?? [])
  const misses = cmp.flatMap((c) => [
    ...(c.accGap < 0 ? [`accuracy ${c.accGap.toFixed(3)} vs ${c.rival} (n=${c.n})`] : []),
    ...(c.p50Gap > c.bar
      ? [`p50 +${c.p50Gap.toFixed(0)} ms vs ${c.rival}, bar ${c.bar.toFixed(0)} ms (n=${c.n})`]
      : []),
  ])
  if (cmp.length > 0 && misses.length === 0)
    return { command, result: 'pass', detail: `${cmp.length} rivals within bar` }
  const ceiling = ceilings.find((c) => c.command === command)
  if (ceiling) return { command, result: 'ceiling', detail: ceiling.reason }
  const why = cmp.length === 0 ? ['no task scored by webular and a rival'] : misses
  return { command, result: 'fail', detail: why.join('; ') }
}

export const parity = (
  doc: string,
  records: readonly Row[],
  ceilings: readonly Ceiling[],
): Verdict[] => mappedCommands(doc).map((c) => verdictFor(c, records, ceilings))

const PeerRun = Schema.fromJsonString(
  Schema.Struct({
    records: Schema.Array(
      Schema.Struct({
        provider: Schema.String,
        task: Schema.String,
        job: Schema.String,
        run: Schema.Number,
        status: Schema.String,
        metrics: Schema.Record(Schema.String, Schema.Number),
        cached: Schema.optionalKey(Schema.Boolean),
      }),
    ),
  }),
)
const Ceilings = Schema.fromJsonString(Schema.Array(Ceiling))

// The doc, the ceilings, and the committed peer run with the highest timestamp (the one bench:docs reads).
export const load = (root: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const name = pickRun(yield* fs.readDirectory(`${root}bench/results/`)) ?? 'missing.json'
    const run = yield* Schema.decodeUnknownEffect(PeerRun)(
      yield* fs.readFileString(`${root}bench/results/${name}`),
    )
    const ceilings = yield* Schema.decodeUnknownEffect(Ceilings)(
      yield* fs.readFileString(`${root}bench/command-parity-ceilings.json`),
    )
    const doc = yield* fs.readFileString(`${root}docs/command-parity.md`)
    // ponytail: records keep only the fields parity reads; the cast widens them to Row.
    return { name, doc, ceilings, records: run.records as unknown as Row[] }
  })
