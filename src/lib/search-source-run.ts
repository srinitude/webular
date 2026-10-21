// One search source under the settle contract: every query variant at once,
// each under SOURCE_TIMEOUT_MS, cut at the shared settle cutoff.
import { Cause, Clock, Deferred, Effect, Ref } from 'effect'
import { HttpStatusError } from '../core/http-body.ts'
import { MAX_VARIANTS } from './search-source-names.ts'
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
  const markHit = Effect.flatMap(Clock.currentTimeMillis, (at) => Ref.update(firstHit, (t) => t ?? at))
  const cut = Effect.as(settle.cutoff, { status: 'timeout', hits: [] } as Outcome)
  const outcomes = yield* Effect.forEach(
    queries,
    (q) =>
      runSource(source, q, limit).pipe(
        Effect.timeout(SOURCE_TIMEOUT_MS),
        Effect.match({ onFailure: failed, onSuccess: found }),
        Effect.tap((o) =>
          o.hits.length ? Effect.andThen(markHit, Deferred.succeed(settle.hit, undefined)) : Effect.void,
        ),
        Effect.raceFirst(cut),
      ),
    { concurrency: MAX_VARIANTS + 1 },
  )
  const endedAt = yield* Clock.currentTimeMillis
  const ms = endedAt - start
  const status = outcomes.reduce<SourceStatus>(
    (best, o) => (rank(o.status) < rank(best) ? o.status : best),
    outcomes[0]?.status ?? 'no-results',
  )
  const firstHitAt = yield* Ref.get(firstHit)
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
