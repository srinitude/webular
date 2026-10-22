// One search source under the settle contract: every query variant at once,
// each under SOURCE_TIMEOUT_MS, cut at the shared settle cutoff.
import { Cause, Clock, Deferred, Effect, Option, Ref } from 'effect'
import { HttpStatusError } from '../core/http-body.ts'
import { MAX_VARIANTS } from './search-source-names.ts'
import { SourceStats } from './search-source-score.ts'
import { type SearchSource, SOURCE_TIMEOUT_MS } from './sources-search.ts'

export interface Hit {
  title: string
  url: string
  description: string
}

export type SourceRunner = (
  source: SearchSource,
  query: string,
  limit: number,
) => Effect.Effect<Hit[], unknown>

export type SourceStatus = 'ok' | 'no-results' | 'timeout' | `blocked:${number}` | 'error'
type Outcome = { status: SourceStatus; hits: Hit[] }

const failed = (cause: unknown): Outcome => ({
  hits: [],
  status: Cause.isTimeoutError(cause)
    ? 'timeout'
    : cause instanceof HttpStatusError
      ? `blocked:${cause.status}`
      : 'error',
})
const found = (hits: Hit[]): Outcome => ({ hits, status: hits.length ? 'ok' : 'no-results' })
const rank = (s: SourceStatus) => (s === 'ok' ? 0 : s === 'no-results' ? 1 : 2)

// Once any source has hits, the rest get SETTLE_GRACE_MS more, then count as
// timed out, so a stalled API (OpenAlex) costs the grace, not SOURCE_TIMEOUT_MS.
// Measured: the useful sources answer within ~500 ms of the first hit.
export const SETTLE_GRACE_MS = 750

// One query variant: capped at SOURCE_TIMEOUT_MS, `onHit` runs when it has
// hits, and `cut` ends it at the settle cutoff.
const runVariant = (
  run: Effect.Effect<Hit[], unknown>,
  onHit: Effect.Effect<void>,
  cut: Effect.Effect<Outcome>,
) =>
  run.pipe(
    Effect.timeout(SOURCE_TIMEOUT_MS),
    Effect.match({ onFailure: failed, onSuccess: found }),
    Effect.tap((o) => (o.hits.length ? onHit : Effect.void)),
    Effect.raceFirst(cut),
  )

const bestStatus = (outcomes: ReadonlyArray<Outcome>) =>
  outcomes.reduce<SourceStatus>(
    (best, o) => (rank(o.status) < rank(best) ? o.status : best),
    outcomes[0]?.status ?? 'no-results',
  )

// Trailing navigational filler ("Bun runtime documentation homepage"): the
// free full-text APIs need every word, so it hides the project. Questions and
// a query that is only filler stay as they are.
const TRAILING_NAV =
  /(?:\s+(?:official|site|website|homepage|home page|docs?|documentation|library|github))+\s*$/i
export const navCore = (q: string) => (q.trim().endsWith('?') ? q : q.replace(TRAILING_NAV, ''))

// One source, every query variant at once; the best variant status wins.
// `hit` fires on the first variant with hits; `cutoff` ends the stragglers.
export const querySource = Effect.fn('querySource')(function* (
  source: SearchSource,
  queries: ReadonlyArray<string>,
  limit: number,
  runSource: SourceRunner,
  settle: { hit: Deferred.Deferred<void>; cutoff: Effect.Effect<void> },
) {
  const start = yield* Clock.currentTimeMillis
  const firstHit = yield* Ref.make<number | null>(null)
  const markHit = Effect.flatMap(Clock.currentTimeMillis, (at) =>
    Ref.update(firstHit, (t) => t ?? at),
  )
  const onHit = Effect.andThen(markHit, Deferred.succeed(settle.hit, undefined))
  const cut = Effect.as(settle.cutoff, { status: 'timeout', hits: [] } as Outcome)
  const outcomes = yield* Effect.forEach(
    queries,
    (q) => runVariant(runSource(source, navCore(q), limit), onHit, cut),
    { concurrency: MAX_VARIANTS + 1 },
  )
  const endedAt = yield* Clock.currentTimeMillis
  const ms = endedAt - start
  const status = bestStatus(outcomes)
  const firstHitAt = yield* Ref.get(firstHit)
  // Feeds the observed ranking when a SourceStats layer is provided.
  const stats = yield* Effect.serviceOption(SourceStats)
  if (Option.isSome(stats)) yield* stats.value.record(source, status, ms)
  return { source, status, ms, firstHitAt, endedAt, lists: outcomes.map((o) => o.hits) }
})

interface TraceRow {
  source: string
  status: SourceStatus
  ms: number
  firstHitAt: number | null
  endedAt: number
}

// WEBULAR_TRACE line: every time is ms since the search started (`start`);
// settleEndMs is when the settle cutoff fires, the earliest hit plus the grace.
export const traceLine = (start: number, rows: ReadonlyArray<TraceRow>, judgeAt: number | null) => {
  const hits = rows.flatMap((r) => (r.firstHitAt === null ? [] : [r.firstHitAt]))
  return JSON.stringify({
    trace: 'search',
    judgeWaitMs: judgeAt === null ? null : judgeAt - start,
    settleEndMs: hits.length ? Math.min(...hits) + SETTLE_GRACE_MS - start : null,
    sources: Object.fromEntries(
      rows.map((r) => [
        r.source,
        {
          status: r.status,
          ms: r.ms,
          firstHitMs: r.firstHitAt === null ? null : r.firstHitAt - start,
          settleMs: r.endedAt - start,
        },
      ]),
    ),
  })
}
