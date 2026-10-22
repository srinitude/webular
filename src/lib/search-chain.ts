// Search across keyless sources. Web asks its free APIs at once, each under SOURCE_TIMEOUT_MS,
// and fuses their lists (plus variants and a local index list) by class-weighted RRF + the
// official-domain signal. DuckDuckGo HTML runs only when no free API had hits, then the
// free sources answer. Crossref and OpenAlex: scholarly.ts.
import { Clock, Config, Deferred, Effect } from 'effect'
import { logErr } from '../core/output.ts'
import { crossref, npm, openalex } from './scholarly.ts'
import { lexicalRerank, scoreHits, WEAK_SCORE, webSearch } from './search.ts'
import { secondHop } from './search-hop.ts'
import { pickSources, pickSourcesJudged } from './search-intent.ts'
import { type Constraints, constraintsOf, matchesConstraints } from './search-query.ts'
import { entityVariant, queriesFor } from './search-source-names.ts'
import {
  type Hit,
  querySource,
  SETTLE_GRACE_MS,
  type SourceRunner,
  type SourceStatus,
  traceLine,
} from './search-source-run.ts'
import { listWeights } from './search-source-score.ts'
import { isNavigational, withOfficial } from './sources/official-sites.ts'
import { type FreeSource, freeSourceFallback } from './sources/registry.ts'
import { githubSearch, marginalia } from './sources/web.ts'
import { type SearchSource, SOURCE_TIMEOUT_MS, sourceSearch } from './sources-search.ts'

// One DuckDuckGo request returns a whole page; fusion ranks it and the caller slices.
const WEB_PAGE = 30
// Navigational queries: the official sites of this many top Wikipedia articles.
const OFFICIAL_ARTICLES = 5

const one: SourceRunner = (source, query, limit) => {
  if (source === 'crossref') return crossref(query, limit)
  if (source === 'openalex') return openalex(query, limit)
  if (source === 'npm') return npm(query, limit)
  if (source === 'marginalia') return marginalia(query, limit)
  if (source === 'github-search') return githubSearch(query, limit)
  if (source === 'web') return webSearch(query, WEB_PAGE)
  return sourceSearch(source, query, limit)
}

// Whole-search budget: each round stops at SOURCE_TIMEOUT_MS, so this trips only when
// something ignores its timeout. A caller may pass a shorter deadlineMs (answer mode does).
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

// WEBULAR_DETERMINISTIC=1: no settle cutoff, so source timing never changes the hits.
const deterministic = Config.String('WEBULAR_DETERMINISTIC').pipe(
  Config.withDefault(''),
  Effect.map((v) => v === '1'),
  Effect.orDie,
)
const graceAfter = (hit: Deferred.Deferred<void>) =>
  Effect.andThen(Deferred.await(hit), Effect.sleep(SETTLE_GRACE_MS))

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
  const queries = queriesFor(query, opts.variants)
  const runSource =
    opts.runSource ?? (isNavigational(query) ? withOfficial(query, one, OFFICIAL_ARTICLES) : one)
  const hit = yield* Deferred.make<void>()
  const uncut = { hit, cutoff: Effect.never }
  const settle = (yield* deterministic) ? uncut : { hit, cutoff: graceAfter(hit) }
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
  opts: SearchOptions & { c: Constraints },
) {
  const start = yield* Clock.currentTimeMillis
  const traced = yield* Config.String('WEBULAR_TRACE').pipe(Config.withDefault(''), Effect.orDie)
  const { ran, judgeAt } = yield* fanOut(source, query, limit, opts)
  if (traced === '1') yield* logErr(traceLine(start, ran, judgeAt))
  const scored = scoreHits(
    [...ran.flatMap((r) => r.lists), ...(opts.local ? [opts.local] : [])],
    query,
    ran.flatMap(listWeights),
  ).filter((e) => matchesConstraints(e.hit, opts.c))
  const ok = ran.filter((r) => r.status === 'ok').length
  const meta: SearchMeta = {
    sources: Object.fromEntries(ran.map((r) => [r.source, { status: r.status, ms: r.ms }])),
    degraded: ok * 2 < ran.length,
    weak: (scored[0]?.score ?? 0) < WEAK_SCORE,
  }
  const hits = scored.map((e) => e.hit)
  // Web only (other sources keep their own order), never under the answer hop: BM25 over
  // a multi-hop question lifts pages sharing its bridge words over the hop's fused order.
  const rerank = source === 'web' && !opts.hop
  return { results: (rerank ? lexicalRerank(hits, query) : hits).slice(0, limit), meta }
})

interface Found {
  results: Hit[]
  meta: SearchMeta
}
type Searched = Found & { source?: FreeSource }

const hitFields = ({ title, url, description }: Hit) => ({ title, url, description })
// Nothing found, DuckDuckGo included: the free sources answer and `source`
// names the one that did. If they all fail, the empty round stands.
const withFreeSources = (query: string, limit: number, found: Found, c: Constraints) =>
  found.results.length > 0
    ? Effect.succeed(found)
    : freeSourceFallback('search', query, limit).pipe(
        Effect.map(({ source, results }) => ({
          ...found,
          source,
          results: results.filter((h) => matchesConstraints(h, c)).map(hitFields),
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
  const c = yield* constraintsOf([query, ...(opts.variants ?? [])])
  const once = { ...opts, c }
  // Deterministic mode: no wall-clock cut; each source still stops at its own cap.
  const det = yield* deterministic
  const cut =
    <A>(duration: number, orElse: () => Effect.Effect<A>) =>
    (self: Effect.Effect<A>) =>
      det ? self : Effect.timeoutOrElse(self, { duration, orElse })
  const first = yield* searchOnce(source, query, limit, once).pipe(cut(deadline, timedOut))
  const free = (found: Found): Effect.Effect<Searched> =>
    source === 'web' && !opts.runSource
      ? withFreeSources(query, limit, found, c)
      : Effect.succeed(found)
  if (!opts.hop || source !== 'web') return yield* free(first)
  const left = deadline - ((yield* Clock.currentTimeMillis) - start)
  const round = (q: string, n: number) =>
    searchOnce('web', q, n, { runSource: opts.runSource, c, hop: true })
  return yield* secondHop(query, limit, first, round).pipe(
    cut(Math.max(0, left), () => Effect.succeed(first)),
    Effect.flatMap(free),
  )
})

export { entityVariant, pickSources, SETTLE_GRACE_MS, type SourceRunner }
