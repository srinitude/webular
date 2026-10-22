// One per-call timeout for every arm (spec-grading-and-stats.md, Timeouts),
// and latency that keeps failed rows (spec-integrity-and-report.md rule 24):
// an error row enters latency censored at the timeout instead of dropping out.
// Choice: failure-inclusive percentiles, not a Kaplan-Meier median; the spec
// names neither, and with one fixed censor point both give the same p50.
import type { RunRecord } from './model.ts'

export const CALL_TIMEOUT_MS = 60_000

export const censoredLatencies = (rows: readonly RunRecord[]): number[] =>
  rows.flatMap((r) => {
    if (r.status === 'error') return [CALL_TIMEOUT_MS]
    const ms = r.status === 'ok' ? r.metrics['latencyMs'] : undefined
    return ms === undefined ? [] : [ms]
  })
