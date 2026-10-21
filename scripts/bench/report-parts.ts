// The eleven report.md parts (spec-integrity-and-report.md "Report format"),
// each a pure function from report input to Markdown. The agent and grader
// tracks are written by the models helper, so they are not here.
import { costPerCorrect, rowBytes, rowHosts, rowUsd } from './cost.ts'
import type { Comparison, Family, Row } from './schema.ts'

export interface Header {
  readonly setVersion: string
  readonly roundId: string
  readonly date: string
  readonly commit: string
  readonly judgeModel: string
  readonly region: string
  readonly tools: ReadonlyArray<{ name: string; version: string; settingsHash: string }>
}

// score null means the tool does not offer the job (never scored 0).
export interface FamilyResult {
  readonly family: Family
  readonly tool: string
  readonly n: number
  readonly score: number | null
  readonly ci: readonly [number, number] | null
  readonly comparison?: Comparison
  readonly errorRate: number
  readonly costPerCorrect: number | null
  readonly webularOnly: boolean
}

export interface ReportInput {
  readonly header: Header
  readonly results: readonly FamilyResult[]
  readonly answerSplit: ReadonlyArray<{
    tool: string
    retrieval: number
    fixedReader: number
    nativeAnswer: number
    closedBook: number
    memory: number
  }>
  readonly rows: readonly Row[]
  readonly correct: Readonly<Record<string, number>>
  readonly slices: ReadonlyArray<{
    axis: string
    value: string
    tool: string
    n: number
    score: number
  }>
  readonly publicPrivate: ReadonlyArray<{ family: Family; tool: string; pub: number; priv: number }>
  readonly claims: readonly VendorClaim[]
  readonly changes: ReadonlyArray<{ text: string; commit: string }>
}

// A vendor's own number next to the harness number, with its URL and date.
export interface VendorClaim {
  readonly tool: string
  readonly metric: string
  readonly claimed: string
  readonly measured: string
  readonly url: string
  readonly date: string
}

const num = (x: number | null, digits = 2) => (x === null ? 'n/a' : x.toFixed(digits))
const ci = (c: readonly [number, number] | null) =>
  c === null ? '' : ` [${num(c[0])}, ${num(c[1])}]`

export const table = (head: readonly string[], body: readonly (readonly string[])[]) =>
  [head, head.map(() => '---'), ...body].map((r) => `| ${r.join(' | ')} |`).join('\n')

export const section = (n: number, title: string, body: string) => `## ${n}. ${title}\n\n${body}\n`

export const headline = (results: readonly FamilyResult[]) => results.filter((r) => !r.webularOnly)

export const header = (h: Header) =>
  section(
    1,
    'Header',
    `Set ${h.setVersion}, round ${h.roundId}, ${h.date}, harness ${h.commit}, judge ${h.judgeModel}, region ${h.region}.\n\n${table(
      ['tool', 'version', 'settings hash'],
      h.tools.map((t) => [t.name, t.version, t.settingsHash]),
    )}`,
  )

const resultRow = (r: FamilyResult): string[] => {
  if (r.score === null) return [r.tool, String(r.n), 'not offered', '', '', 'not offered', '', '']
  const c = r.comparison
  return [
    r.tool,
    String(r.n),
    `${num(r.score)}${ci(r.ci)}`,
    c === undefined ? '' : `${num(c.diff)}${ci(c.ci)}`,
    c === undefined ? '' : num(c.pHolm, 3),
    c === undefined ? '' : c.verdict,
    num(r.errorRate),
    num(r.costPerCorrect, 4),
  ]
}

const RESULT_HEAD = ['tool', 'n', 'score (95% CI)', 'diff vs webular (CI)', 'Holm p', 'verdict']

export const results = (rs: readonly FamilyResult[]) => {
  const shown = headline(rs)
  const families = [...new Set(shown.map((r) => r.family))]
  const tables = families.map(
    (f) =>
      `### ${f}\n\n${table(
        [...RESULT_HEAD, 'error rate', 'cost per correct'],
        shown.filter((r) => r.family === f).map(resultRow),
      )}`,
  )
  return section(2, 'Results per family', tables.join('\n\n'))
}

export const answerSplit = (a: ReportInput['answerSplit']) =>
  section(
    3,
    'Answer job split',
    table(
      ['tool', 'retrieval', 'fixed reader', 'native answer', 'closed book', 'memory tasks'],
      a.map((r) => [
        r.tool,
        num(r.retrieval),
        num(r.fixedReader),
        num(r.nativeAnswer),
        num(r.closedBook),
        String(r.memory),
      ]),
    ),
  )

// Nearest-rank percentile of sorted values.
export const pct = (sorted: readonly number[], p: number) =>
  sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0

const groupBy = <A>(xs: readonly A[], key: (a: A) => string) =>
  xs.reduce((m, x) => m.set(key(x), [...(m.get(key(x)) ?? []), x]), new Map<string, A[]>())

// Cold and warm are always apart; a pooled percentile is never computed.
export const latency = (rows: readonly Row[]) => {
  const groups = groupBy(rows, (r) => `${r.key.provider} | ${r.family} | ${r.phase}`)
  const body = [...groups].map(([k, g]) => {
    const ms = g.map((r) => r.latencyMs).sort((a, b) => a - b)
    const cached = g.filter((r) => r.cached).length
    return [...k.split(' | '), ...[50, 90, 99].map((p) => num(pct(ms, p), 0)), String(cached)]
  })
  return section(
    4,
    'Latency',
    table(['tool', 'job', 'phase', 'p50 ms', 'p90 ms', 'p99 ms', 'cached rows'], body),
  )
}

export const cost = (rows: readonly Row[], correct: ReportInput['correct']) => {
  const body = [...groupBy(rows, (r) => r.key.provider)].map(([tool, g]) => {
    const calls = g.flatMap((r) => r.calls)
    const sources = [...new Set(calls.map((c) => `${c.priceSource} (${c.priceDate})`))]
    return [
      tool,
      num(
        g.reduce((s, r) => s + rowUsd(r), 0),
        4,
      ),
      String(g.reduce((s, r) => s + rowBytes(r), 0)),
      String(new Set(g.flatMap(rowHosts)).size),
      String(correct[tool] ?? 0),
      num(costPerCorrect(g, correct[tool] ?? 0), 4),
      sources.join('<br>'),
    ]
  })
  const head = [
    'tool',
    'usd',
    'bytes',
    'hosts',
    'correct',
    'cost per correct',
    'price source (date)',
  ]
  return section(5, 'Cost and accuracy', table(head, body))
}
