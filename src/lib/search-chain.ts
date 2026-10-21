// Search across keyless sources. The default web source asks the free APIs
// that fit the query's intent all at once, each under SOURCE_TIMEOUT_MS, and
// fuses their lists (plus query variants and a local index list) with RRF +
// the official-domain signal. Scraped DuckDuckGo HTML runs only when no free
// API had hits; when that finds nothing too, the free sources answer.
// Crossref and OpenAlex live in scholarly.ts.
import { Cause, Clock, Deferred, Effect } from 'effect'
import { HttpStatusError } from '../core/http-body.ts'
import { crossref, npm, openalex } from './scholarly.ts'
import { scoreHits, WEAK_SCORE, webSearch } from './search.ts'
import { secondHop } from './search-hop.ts'
import { pickSources } from './search-intent.ts'
import { MAX_VARIANTS } from './search-source-names.ts'
import { type FreeSource, freeSourceFallback } from './sources/registry.ts'
import { type SearchSource, SOURCE_TIMEOUT_MS, sourceSearch } from './sources-search.ts'

interface Hit {
  title: string
  url: string
  description: string
}

// One DuckDuckGo request returns its whole page whatever the limit; fusion
// ranks the full page and the caller's slice keeps the best hits.
const WEB_PAGE = 30

export type SourceRunner = (
  source: SearchSource,
  query: string,
  limit: number,
) => Effect.Effect<Hit[], unknown>

const one: SourceRunner = (source, query, limit) => {
  if (source === 'crossref') return crossref(query, limit)
  if (source === 'openalex') return openalex(query, limit)
  if (source === 'npm') return npm(query, limit)
  if (source === 'web') return webSearch(query, WEB_PAGE)
  return sourceSearch(source, query, limit)
}

// Whole-search budget: the free-API round and the scraped fallback each stop
// at SOURCE_TIMEOUT_MS, so this only trips if something ignores its timeout.
// A caller can pass a shorter deadlineMs (answer mode does).
const SEARCH_DEADLINE_MS = 3 * SOURCE_TIMEOUT_MS

type SourceStatus = 'ok' | 'no-results' | 'timeout' | `blocked:${number}` | 'error'
interface SearchMeta {
  sources: Record<string, { status: SourceStatus; ms: number }>
  degraded: boolean
  weak: boolean
}
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
const querySource = Effect.fn('querySource')(function* (
  source: SearchSource,
  queries: ReadonlyArray<string>,
  limit: number,
  runSource: SourceRunner,
  settle: { hit: Deferred.Deferred<void>; cutoff: Effect.Effect<void> },
) {
  const start = yield* Clock.currentTimeMillis
  const cut = Effect.as(settle.cutoff, { status: 'timeout', hits: [] } as Outcome)
  const outcomes = yield* Effect.forEach(
    queries,
    (q) =>
      runSource(source, q, limit).pipe(
        Effect.timeout(SOURCE_TIMEOUT_MS),
        Effect.match({ onFailure: failed, onSuccess: found }),
        Effect.tap((o) => (o.hits.length ? Deferred.succeed(settle.hit, undefined) : Effect.void)),
        Effect.raceFirst(cut),
      ),
    { concurrency: MAX_VARIANTS + 1 },
  )
  const ms = (yield* Clock.currentTimeMillis) - start
  const status = outcomes.reduce<SourceStatus>(
    (best, o) => (rank(o.status) < rank(best) ? o.status : best),
    outcomes[0]?.status ?? 'no-results',
  )
  return { source, status, ms, lists: outcomes.map((o) => o.hits) }
})

export interface SearchOptions {
  variants?: ReadonlyArray<string>
  // Ranked list from the local BM25 index; fused like any source.
  local?: ReadonlyArray<Hit>
  runSource?: SourceRunner | undefined
  // Answer mode: allow one entity-then-fact hop when the entity page is missing.
  hop?: boolean
  // Whole-search budget, hop included; defaults to SEARCH_DEADLINE_MS.
  deadlineMs?: number
}

const timedOut = () =>
  Effect.succeed({
    results: [] as Hit[],
    meta: { sources: {}, degraded: true, weak: true } as SearchMeta,
  })

// web: the intent's free APIs at once, then DuckDuckGo only if none had hits.
// An explicit source queries just that source.
const searchOnce = Effect.fn('searchOnce')(function* (
  source: SearchSource,
  query: string,
  limit: number,
  opts: SearchOptions = {},
) {
  const queries = [query, ...(opts.variants ?? []).slice(0, MAX_VARIANTS)]
  const runSource = opts.runSource ?? one
  const chosen = source === 'web' ? pickSources(query) : [source]
  const hit = yield* Deferred.make<void>()
  const settle = { hit, cutoff: Effect.andThen(Deferred.await(hit), Effect.sleep(SETTLE_GRACE_MS)) }
  const uncut = { hit, cutoff: Effect.never } // npm: official homepages; only its own cap stops it
  const ran = yield* Effect.forEach(
    chosen,
    (s) => querySource(s, queries, limit, runSource, s === 'npm' ? uncut : settle),
    { concurrency: chosen.length },
  )
  if (source === 'web' && !ran.some((r) => r.status === 'ok'))
    ran.push(yield* querySource('web', queries, limit, runSource, settle))
  const scored = scoreHits(
    [...ran.flatMap((r) => r.lists), ...(opts.local ? [opts.local] : [])],
    query,
  )
  const ok = ran.filter((r) => r.status === 'ok').length
  const meta: SearchMeta = {
    sources: Object.fromEntries(ran.map((r) => [r.source, { status: r.status, ms: r.ms }])),
    degraded: ok * 2 < ran.length,
    weak: (scored[0]?.score ?? 0) < WEAK_SCORE,
  }
  return { results: scored.slice(0, limit).map((e) => e.hit), meta }
})

interface Found {
  results: Hit[]
  meta: SearchMeta
}
type Searched = Found & { source?: FreeSource }

// Nothing found, DuckDuckGo included: the free sources answer and `source`
// names the one that did. If they all fail, the empty round stands.
const withFreeSources = (query: string, limit: number, found: Found): Effect.Effect<Searched> =>
  found.results.length > 0
    ? Effect.succeed(found)
    : freeSourceFallback('search', query, limit).pipe(
        Effect.map(({ source, results }) => ({
          ...found,
          source,
          results: results.map(({ title, url, description }) => ({ title, url, description })),
        })),
        Effect.catch(() => Effect.succeed(found)),
      )

// The whole search, second hop included, stays inside SEARCH_DEADLINE_MS; a
// hop that runs out of time keeps the first round's results. An injected
// runSource owns every source, so the free-source fallback stays out.
export const searchEffect = Effect.fn('search')(function* (
  source: SearchSource,
  query: string,
  limit: number,
  opts: SearchOptions = {},
) {
  const deadline = opts.deadlineMs ?? SEARCH_DEADLINE_MS
  const start = yield* Clock.currentTimeMillis
  const first = yield* searchOnce(source, query, limit, opts).pipe(
    Effect.timeoutOrElse({ duration: deadline, orElse: timedOut }),
  )
  const free = (found: Found): Effect.Effect<Searched> =>
    source === 'web' && !opts.runSource
      ? withFreeSources(query, limit, found)
      : Effect.succeed(found)
  if (!opts.hop || source !== 'web') return yield* free(first)
  const left = deadline - ((yield* Clock.currentTimeMillis) - start)
  const round = (q: string, n: number) => searchOnce('web', q, n, { runSource: opts.runSource })
  return yield* secondHop(query, limit, first, round).pipe(
    Effect.timeoutOrElse({ duration: Math.max(0, left), orElse: () => Effect.succeed(first) }),
    Effect.flatMap(free),
  )
})

export { pickSources }
