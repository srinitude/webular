// Deterministic grading (spec-grading-and-stats.md, grading order step 1):
// normalized checks run before any judge. Answer jobs are graded apart
// (audit finding 1, guard test 19); error rows never pass and stay in
// latency as censored at the timeout (audit finding 10, guard test 24).
import { Effect, Option } from 'effect'
import { gradeRobots, type RobotsOutcome } from './robots-grade.ts'
import type { Check, Row, Status, Task } from './schema.ts'

export const ANSWER_MODES = [
  'retrieve.evidence',
  'answer.fixed-reader',
  'answer.native',
  'closed-book',
] as const
type AnswerMode = (typeof ANSWER_MODES)[number]

interface Graded {
  readonly taskId: string
  readonly provider: string
  readonly mode: AnswerMode | undefined
  readonly status: Status
  readonly pass: boolean
  // Set on robots-gold tasks only; scored in its own report column, not accuracy.
  readonly robots?: RobotsOutcome
}

export const normalizeText = (s: string): string =>
  s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const TRACKING = /^(utm_.*|gclid|fbclid)$/i

export const normalizeUrl = (raw: string): string | undefined => {
  if (!URL.canParse(raw)) return undefined
  const u = new URL(raw)
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, '')
  u.hash = ''
  for (const key of [...u.searchParams.keys()]) {
    if (TRACKING.test(key)) u.searchParams.delete(key)
  }
  return u.toString().replace(/\/$/, '')
}

const urlsIn = (text: string): string[] => text.match(/https?:\/\/[^\s<>"'()[\]]+/g) ?? []

const hasPhrase = (text: string, phrase: string): boolean => {
  const p = normalizeText(phrase)
  return p !== '' && ` ${normalizeText(text)} `.includes(` ${p} `)
}

// Alias match on word boundaries: "paris" matches "in Paris." but not "Parisian".
export const aliasMatch = (answer: string, aliases: readonly string[]): boolean =>
  aliases.some((a) => hasPhrase(answer, a))

const numbersIn = (text: string): number[] =>
  (text.replace(/(\d),(\d)/g, '$1$2').match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)

// An invalid gold pattern fails the check instead of passing it.
const safeRegex = Option.liftThrowable((pattern: string) => new RegExp(pattern, 'iu'))

export const runCheck = (check: Check, output: string): boolean => {
  switch (check.kind) {
    case 'contains':
      return hasPhrase(output, check.value)
    case 'excludes':
      return !hasPhrase(output, check.value)
    case 'regex':
      return Option.exists(safeRegex(check.value), (r) => r.test(output))
    case 'urlMatches': {
      const gold = normalizeUrl(check.value)
      return gold !== undefined && urlsIn(output).some((u) => normalizeUrl(u) === gold)
    }
    case 'numeric':
      return numbersIn(output).some((n) => Math.abs(n - check.value) <= check.tolerance)
  }
}

// An "ok" row with no text is empty, not ok.
const effectiveStatus = (row: Row): Status =>
  row.status === 'ok' && row.output.trim() === '' ? 'empty' : row.status

export const gradeRow = (task: Task, row: Row, mode?: AnswerMode): Graded => {
  const status = effectiveStatus(row)
  if (task.expect !== undefined) {
    return { taskId: task.id, provider: row.key.provider, mode, status, ...gradeRobots(row) }
  }
  const aliasOk = task.aliases.length === 0 || aliasMatch(row.output, task.aliases)
  const pass = status === 'ok' && aliasOk && task.checks.every((c) => runCheck(c, row.output))
  return { taskId: task.id, provider: row.key.provider, mode, status, pass }
}

// Results grouped by answer job; never pooled across jobs.
export const byMode = (graded: readonly Graded[]): ReadonlyMap<AnswerMode, readonly Graded[]> => {
  const out = new Map<AnswerMode, Graded[]>()
  for (const g of graded) {
    if (g.mode !== undefined) out.set(g.mode, [...(out.get(g.mode) ?? []), g])
  }
  return out
}

// Guard test 19: a scored group must hold exactly one answer job.
export const checkModesApart = (group: readonly Graded[]): Effect.Effect<void, Error> => {
  const modes = new Set(group.map((g) => g.mode))
  return modes.size > 1
    ? Effect.fail(new Error(`answer modes pooled: ${[...modes].join(', ')}`))
    : Effect.void
}

interface LatencySample {
  readonly ms: number
  readonly censored: boolean
}

// Every row enters latency; failures are censored at the timeout.
export const latencySamples = (rows: readonly Row[], timeoutMs: number): LatencySample[] =>
  rows.map((r) =>
    effectiveStatus(r) === 'ok'
      ? { ms: r.latencyMs, censored: false }
      : { ms: Math.max(r.latencyMs, timeoutMs), censored: true },
  )

// Guard test 24: no failed row is scored ok, and no row leaves the latency set.
export const checkErrorRows = (
  rows: readonly Row[],
  graded: readonly Graded[],
  latency: readonly LatencySample[],
): Effect.Effect<void, Error> => {
  const bad = rows.find((r, i) => {
    const g = graded[i]
    return effectiveStatus(r) !== 'ok' && (g === undefined || g.pass || g.status === 'ok')
  })
  if (bad !== undefined) return Effect.fail(new Error(`failed row scored ok: ${bad.key.taskId}`))
  return latency.length === rows.length && graded.length === rows.length
    ? Effect.void
    : Effect.fail(new Error(`rows dropped: ${rows.length} rows, ${latency.length} latency samples`))
}
