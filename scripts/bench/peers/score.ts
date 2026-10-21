// Scoring: exact checks per record, then one summary per provider, then a
// per-dimension winner and webular's gap on every metric. Pure functions only.
import type { Check, MetricDef, Provider, RecordedOutput, RunRecord, Task } from './model.ts'

const fold = (s: string) => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()

export function checkPasses(check: Check, out: Pick<RecordedOutput, 'text' | 'urls'>): boolean {
  const text = fold(out.text)
  switch (check.kind) {
    case 'contains':
      return check.values.some((v) => text.includes(fold(v)))
    case 'excludes':
      return check.values.every((v) => !text.includes(fold(v)))
    case 'regex':
      return check.values.some((v) => new RegExp(v, 'iu').test(out.text))
    case 'urlMatches':
      return out.urls.some((u) => check.values.some((v) => new RegExp(v, 'i').test(u)))
  }
}

// ponytail: chars/4 token estimate; swap in a real tokenizer if ranking hinges on it.
export const tokens = (text: string) => Math.ceil(text.length / 4)

export function recordMetrics(
  task: Task,
  out: RecordedOutput,
  planMetrics: readonly MetricDef[],
): Record<string, number> {
  const m: Record<string, number> = {
    accuracy: task.checks.every((c) => checkPasses(c, out)) ? 1 : 0,
    latencyMs: out.latencyMs,
    costUsd: out.costUsd,
    tokens: tokens(out.text),
    retries: out.attempts - 1,
    sentBytes: out.sentBytes,
  }
  const cited = out.citations.filter((c) => c.text.length > 0)
  if (task.answers && cited.length > 0) {
    const answers = { kind: 'contains' as const, values: task.answers }
    const ok = cited.filter((c) => checkPasses(answers, { text: c.text, urls: [] }))
    m['citationPrecision'] = ok.length / cited.length
  }
  for (const def of planMetrics) if (def.check) m[def.name] = checkPasses(def.check, out) ? 1 : 0
  return m
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : undefined)
export function percentile(xs: number[], p: number): number | undefined {
  if (!xs.length) return undefined
  const s = xs.toSorted((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]
}

export type Summary = Record<string, Record<string, number | undefined>>

// Scored = ran and produced ok or error; skipped and unsupported rows say why
// a provider has no number, but never count against or for it.
const scored = (r: RunRecord) => r.status === 'ok' || r.status === 'error'

const column = (rows: readonly RunRecord[], k: string) =>
  rows.map((r) => r.metrics[k]).filter((v): v is number => v !== undefined)

function determinism(rows: readonly RunRecord[]): number | undefined {
  const byTask = new Map<string, Set<string | undefined>>()
  for (const r of rows) byTask.set(r.task, (byTask.get(r.task) ?? new Set()).add(r.outputHash))
  const repeated = new Set(rows.filter((r) => r.run > 1).map((r) => r.task))
  return mean([...repeated].map((t) => (byTask.get(t)?.size === 1 ? 1 : 0)))
}

function providerSummary(p: Provider, rows: readonly RunRecord[], defs: readonly MetricDef[]) {
  const ok = rows.filter((r) => r.status === 'ok')
  const correct = sum(column(rows, 'accuracy'))
  const cost = sum(column(rows, 'costUsd'))
  const toks = sum(column(ok, 'tokens'))
  const lat = column(ok, 'latencyMs')
  const s: Record<string, number | undefined> = {
    accuracy: mean(column(rows, 'accuracy')),
    citationPrecision: mean(column(ok, 'citationPrecision')),
    latencyP50Ms: percentile(lat, 50),
    latencyP95Ms: percentile(lat, 95),
    latencyP99Ms: percentile(lat, 99),
    coldStartMs: ok.find((r) => r.run === 1)?.metrics['latencyMs'],
    costPerCallUsd: mean(column(rows, 'costUsd')),
    costPerCorrectUsd: correct > 0 ? cost / correct : undefined,
    costPer1kTokensUsd: toks > 0 ? cost / (toks / 1000) : undefined,
    tokensPerTask: mean(column(ok, 'tokens')),
    tokensPerCorrect: correct > 0 ? toks / correct : undefined,
    successRate: ok.length / rows.length,
    retriesPerCall: mean(column(rows, 'retries')),
    determinism: determinism(rows),
    runsOffline: p.local ? 1 : 0,
    keysNeeded: p.keyNames.length,
    bytesSentOffMachine: mean(column(rows, 'sentBytes')),
  }
  for (const d of defs) if (!(d.name in s)) s[d.name] = mean(column(rows, d.name))
  return s
}

export function summarize(
  records: readonly RunRecord[],
  providers: readonly Provider[],
  defs: readonly MetricDef[],
  taskIds?: ReadonlySet<string>,
): Summary {
  const out: Summary = {}
  for (const p of providers) {
    const rows = records.filter(
      (r) => r.provider === p.id && scored(r) && (!taskIds || taskIds.has(r.task)),
    )
    if (rows.length) out[p.id] = providerSummary(p, rows, defs)
  }
  return out
}

interface MetricVerdict {
  metric: string
  dimension: string
  unit: string
  best?: string | undefined
  bestValue?: number | undefined
  webular?: number | undefined
  // webular minus best, in the metric's own units; 0 when webular wins.
  gap?: number | undefined
}

export function verdicts(summary: Summary, defs: readonly MetricDef[]): MetricVerdict[] {
  return defs.map((d) => {
    const vals = Object.entries(summary)
      .map(([id, s]) => [id, s[d.name]] as const)
      .filter((e): e is readonly [string, number] => e[1] !== undefined)
    const top = vals.reduce<readonly [string, number] | undefined>(
      (a, e) => (!a || (d.better === 'higher' ? e[1] > a[1] : e[1] < a[1]) ? e : a),
      undefined,
    )
    const w = summary['webular']?.[d.name]
    return {
      metric: d.name,
      dimension: d.dimension,
      unit: d.unit,
      best: top?.[0],
      bestValue: top?.[1],
      webular: w,
      gap: w !== undefined && top ? w - top[1] : undefined,
    }
  })
}

// Dimension winner: the provider that wins the most metrics in it.
export function dimensionWinners(vs: readonly MetricVerdict[]): Record<string, string> {
  const tally = new Map<string, Map<string, number>>()
  for (const v of vs) {
    if (!v.best) continue
    const t = tally.get(v.dimension) ?? new Map<string, number>()
    t.set(v.best, (t.get(v.best) ?? 0) + 1)
    tally.set(v.dimension, t)
  }
  const out: Record<string, string> = {}
  for (const [dim, t] of tally) {
    let top: [string, number] = ['', -1]
    for (const e of t) if (e[1] > top[1]) top = e
    out[dim] = top[0]
  }
  return out
}

// Tasks every listed provider scored: the only fair ground for a comparison.
export function sharedTasks(records: readonly RunRecord[], ids: readonly string[]): Set<string> {
  const per = ids.map(
    (id) => new Set(records.filter((r) => r.provider === id && scored(r)).map((r) => r.task)),
  )
  const [head, ...rest] = per
  return new Set([...(head ?? [])].filter((t) => rest.every((s) => s.has(t))))
}

const fmt = (n: number | undefined) =>
  n === undefined ? 'n/a' : Math.abs(n) >= 100 ? n.toFixed(0) : Number(n.toPrecision(3)).toString()

export function renderTable(title: string, summary: Summary, defs: readonly MetricDef[]): string {
  const ids = Object.keys(summary)
  const vs = verdicts(summary, defs)
  const head = ['metric', 'dim', ...ids, 'best', 'webular gap']
  const rows = vs.map((v) => [
    v.metric,
    v.dimension,
    ...ids.map((id) => fmt(summary[id]?.[v.metric])),
    v.best ?? 'n/a',
    v.gap === undefined ? 'n/a' : `${fmt(v.gap)} ${v.unit}`,
  ])
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)))
  const line = (r: string[]) => r.map((c, i) => c.padEnd(widths[i] ?? 0)).join('  ')
  const dims = Object.entries(dimensionWinners(vs)).map(([d, w]) => `  ${d}: ${w}`)
  return [`== ${title} ==`, line(head), ...rows.map(line), 'dimension winners:', ...dims].join('\n')
}
