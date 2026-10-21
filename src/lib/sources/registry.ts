// The one entry point to the free source adapters: each adapter by name, and
// the fallback order each command tries them in (ranked in
// benchmarks/free-sources.md). Ranking and merging stay with the search chain;
// it calls freeSourceSearch, freeSourceFallback or freeSourceStatus and
// decides what to keep.
import { Clock, Data, Duration, Effect } from 'effect'
import { commonCrawlCdx, libraryOfCongress, waybackAvailable, waybackCdx } from './archives.ts'
import { bluesky, reddit, stackExchange } from './communities.ts'
import { type Hit, TIMEOUT_MS } from './polite.ts'
import { rankHits } from './rank.ts'
import { europePmc, ncbiEutils } from './scholarly.ts'
import { feedSearch, githubSearch, marginalia, wikidata } from './web.ts'

// parse and scrape's document route: local anydoc conversion, first in parse's
// fallback order (then Tesseract for a 'needsOcr' failure).
export { documentToMarkdown } from './documents.ts'

export const FREE_SOURCES = {
  wikidata,
  europepmc: europePmc,
  'ncbi-eutils': ncbiEutils,
  stackexchange: stackExchange,
  'github-search': githubSearch,
  marginalia,
  feedsearch: feedSearch,
  'wayback-available': waybackAvailable,
  'wayback-cdx': waybackCdx,
  'commoncrawl-cdx': commonCrawlCdx,
  loc: libraryOfCongress,
  reddit,
  bluesky,
} as const satisfies Record<string, (query: string, limit: number) => Effect.Effect<Hit[], unknown>>

export type FreeSource = keyof typeof FREE_SOURCES

export const FREE_SOURCE_NAMES = Object.keys(FREE_SOURCES) as [FreeSource, ...FreeSource[]]

// Reddit and Bluesky answered 403 to keyless calls, so no command lists them;
// they stay callable by name for a caller that brings its own access.
const FREE_SOURCE_ORDER = {
  search: ['wikidata', 'europepmc', 'stackexchange', 'github-search', 'marginalia', 'loc'],
  answer: ['wikidata', 'stackexchange', 'github-search', 'europepmc'],
  research: ['europepmc', 'ncbi-eutils', 'wikidata', 'stackexchange', 'loc', 'marginalia'],
  summarize: ['wikidata'],
  feed: ['feedsearch'],
  monitor: ['wayback-cdx', 'wayback-available'],
  map: ['wayback-cdx', 'commoncrawl-cdx'],
  crawl: ['commoncrawl-cdx'],
} as const satisfies Record<string, ReadonlyArray<FreeSource>>

type FreeSourceCommand = keyof typeof FREE_SOURCE_ORDER

// How far each source's hits can be believed, in [0, 1]: curated and
// peer-reviewed indexes high, open community and web indexes lower.
// Jev hook point: a per-hit trust judgment (claim vs. source evidence) would
// replace this fixed table; it must keep the type (source: FreeSource) => number.
const SOURCE_TRUST: Record<FreeSource, number> = {
  europepmc: 0.9,
  'ncbi-eutils': 0.9,
  loc: 0.85,
  wikidata: 0.8,
  'wayback-available': 0.7,
  'wayback-cdx': 0.7,
  'commoncrawl-cdx': 0.6,
  stackexchange: 0.6,
  'github-search': 0.5,
  feedsearch: 0.5,
  marginalia: 0.4,
  reddit: 0.3,
  bluesky: 0.3,
}

class FreeSourceError extends Data.TaggedError('FreeSourceError')<{
  source: FreeSource
  cause: unknown
}> {}

class AllFreeSourcesFailed extends Data.TaggedError('AllFreeSourcesFailed')<{
  command: FreeSourceCommand
  failures: ReadonlyArray<{ source: FreeSource; error: string }>
}> {}

// One adapter, cut to `limit`, each hit stamped with its origin and trust.
// Each request inside it has its own TIMEOUT_MS.
export const freeSourceSearch = (source: FreeSource, query: string, limit: number) =>
  FREE_SOURCES[source](query, limit).pipe(
    Effect.map((hits) =>
      hits.slice(0, limit).map((h) => ({ ...h, origin: source, trust: SOURCE_TRUST[source] })),
    ),
    Effect.mapError((cause) => new FreeSourceError({ source, cause })),
  )

// The longest command order; a command asks that many sources at once.
const MAX_SOURCES = 8

const attempt = (source: FreeSource, query: string, limit: number) =>
  freeSourceSearch(source, query, limit).pipe(
    Effect.map((hits) => ({ source, hits, error: hits.length ? '' : 'no hits' })),
    Effect.catch((e) => Effect.succeed({ source, hits: [] as Hit[], error: String(e.cause) })),
  )

// Ask every source routed to a command at once, rank the merged hits by trust
// and recency, and keep `limit`. Every source that failed or came back empty
// is listed in `failures`; when none answered, the run fails with all of them.
export const freeSourceFallback = (command: FreeSourceCommand, query: string, limit: number) =>
  Effect.gen(function* () {
    const ask = (s: FreeSource) => attempt(s, query, limit)
    const runs = yield* Effect.forEach(FREE_SOURCE_ORDER[command], ask, {
      concurrency: MAX_SOURCES,
    })
    const failures = runs.filter((r) => r.error).map(({ source, error }) => ({ source, error }))
    const now = yield* Clock.currentTimeMillis
    const ranked = rankHits(
      runs.flatMap((r) => r.hits),
      now,
    )
    const top = ranked[0]
    if (!top) return yield* new AllFreeSourcesFailed({ command, failures })
    return { source: top.origin as FreeSource, results: ranked.slice(0, limit), failures }
  })

interface FreeSourceStatus {
  source: FreeSource
  ok: boolean
  ms: number
  hits: Hit[]
  error?: string
}

// A whole source run: two requests (NCBI's esearch then esummary) plus the
// per-host gap fit; anything slower is reported as timed out.
const SOURCE_BUDGET = Duration.millis(TIMEOUT_MS * 2)

const statusOf = (source: FreeSource, query: string, limit: number) =>
  freeSourceSearch(source, query, limit).pipe(
    Effect.timeout(SOURCE_BUDGET),
    Effect.timed,
    Effect.map(
      ([took, hits]): FreeSourceStatus => ({ source, ok: true, ms: Duration.toMillis(took), hits }),
    ),
    Effect.catch((e) =>
      Effect.succeed<FreeSourceStatus>({
        source,
        ok: false,
        ms: 0,
        hits: [],
        error: e._tag === 'FreeSourceError' ? String(e.cause) : e.message,
      }),
    ),
  )

// Ask every source of a command at once, one status row each: hits and time,
// or the error. A source that fails or overruns never holds the others; two
// sources on one host still take turns through politely().
export const freeSourceStatus = (command: FreeSourceCommand, query: string, limit: number) =>
  Effect.forEach(FREE_SOURCE_ORDER[command], (source) => statusOf(source, query, limit), {
    concurrency: MAX_SOURCES,
  })
