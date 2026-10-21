// Search across keyless sources. Web asks its free APIs at once, each under
// SOURCE_TIMEOUT_MS, and fuses their lists (plus variants and a local index list)
// by RRF + the official-domain signal. DuckDuckGo HTML runs only when no free API
// had hits, then the free sources answer. Crossref and OpenAlex: scholarly.ts.
import { Clock, Config, Deferred, Effect } from 'effect'
import { logErr } from '../core/output.ts'
import { crossref, npm, openalex } from './scholarly.ts'
import { scoreHits, WEAK_SCORE, webSearch } from './search.ts'
import { secondHop } from './search-hop.ts'
import { pickSources, pickSourcesJudged } from './search-intent.ts'
import { MAX_VARIANTS } from './search-source-names.ts'
import {
  type Hit,
  querySource,
  SETTLE_GRACE_MS,
  type SourceRunner,
  type SourceStatus,
  traceLine,
} from './search-source-run.ts'
import { type FreeSource, freeSourceFallback } from './sources/registry.ts'
import { type SearchSource, SOURCE_TIMEOUT_MS, sourceSearch } from './sources-search.ts'

// One DuckDuckGo request returns its whole page whatever the limit; fusion
// ranks the full page and the caller's slice keeps the best hits.
const WEB_PAGE = 30

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

interface SearchMeta {
  sources: Record<string, { status: SourceStatus; ms: number }>
  degraded: boolean
  weak: boolean
}

export interface SearchOptions {
  variants?: ReadonlyArray<string>
  // Ranked list from the local BM25 index; fused like any source.
  local?: ReadonlyArray<Hit>
  runSource?: SourceRunner | undefined
  // Answer mode: allow one entity-then-fact hop when the entity page is missing.
  hop?: boolean
  // Whole-search budget, hop included; defaults to SEARCH_DEADLINE_MS.
  deadlineMs?: number
  // Intent pick that adds sources mid-search; Jev unless runSource owns every source.
  judge?: ((query: string) => Effect.Effect<SearchSource[]>) | undefined
}

// Deterministic mode (WEBULAR_DETERMINISTIC=1): no settle cutoff, so source
// timing never changes the hits; each source still stops at SOURCE_TIMEOUT_MS.
const deterministic = Config.String('WEBULAR_DETERMINISTIC').pipe(
  Config.withDefault(''),
  Effect.map((v) => v === '1'),
  Effect.orDie,
)

const timedOut = () =>
  Effect.succeed({
    results: [] as Hit[],
    meta: { sources: {}, degraded: true, weak: true } as SearchMeta,
  })

// web: the keyword pick starts at once; the judge's pick adds the sources it
// names when it lands, or is dropped at the settle cutoff. DuckDuckGo runs only
// if no source had hits. npm the keyword pick chose is never cut by the grace
// (official homepages); sources the judge adds late take the settle cutoff.
const fanOut = Effect.fn('fanOut')(function* (
  source: SearchSource,
  query: string,
  limit: number,
  opts: SearchOptions,
) {
  const queries = [query, ...(opts.variants ?? []).slice(0, MAX_VARIANTS)]
  const runSource = opts.runSource ?? one
  const hit = yield* Deferred.make<void>()
  const uncut = { hit, cutoff: Effect.never }
  const grace = Effect.andThen(Deferred.await(hit), Effect.sleep(SETTLE_GRACE_MS))
  const settle = (yield* deterministic) ? uncut : { hit, cutoff: grace }
  const keyword = source === 'web' ? pickSources(query) : [source]
  const query1 = (s: SearchSource) =>
    querySource(s, queries, limit, runSource, s === 'npm' && keyword.includes(s) ? uncut : settle)
  const run = (list: ReadonlyArray<SearchSource>) =>
    Effect.forEach(list, query1, { concurrency: Math.max(1, list.length) })
  const judge =
    source === 'web' ? (opts.judge ?? (opts.runSource ? undefined : pickSourcesJudged)) : undefined
  const late = judge
    ? Effect.raceFirst(judge(query), Effect.as(settle.cutoff, keyword))
    : Effect.succeed(keyword)
  const more = Effect.flatMap(late, (picked) =>
    Effect.all([Clock.currentTimeMillis, run(picked.filter((s) => !keyword.includes(s)))]),
  )
  const [first, [judgedAt, added]] = yield* Effect.all([run(keyword), more], { concurrency: 2 })
  const ran = [...first, ...added]
  if (source === 'web' && !ran.some((r) => r.status === 'ok')) ran.push(yield* query1('web'))
  return { ran, judgeAt: judge ? judgedAt : null }
})

const searchOnce = Effect.fn('searchOnce')(function* (
  source: SearchSource,
  query: string,
  limit: number,
  opts: SearchOptions = {},
) {
  const start = yield* Clock.currentTimeMillis
  const traced = yield* Config.String('WEBULAR_TRACE').pipe(Config.withDefault(''), Effect.orDie)
  const { ran, judgeAt } = yield* fanOut(source, query, limit, opts)
  if (traced === '1') yield* logErr(traceLine(start, ran, judgeAt))
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

type Found = Effect.Success<ReturnType<typeof searchOnce>>
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

export { pickSources, SETTLE_GRACE_MS, type SourceRunner }
