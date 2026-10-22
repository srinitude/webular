// The one entry point to the free source adapters (named in catalog.ts) and
// the fallback order each command tries them in (ranked in
// benchmarks/free-sources.md). Ranking and merging stay with the search chain;
// it calls freeSourceSearch, freeSourceFallback or freeSourceStatus and
// decides what to keep.
import { Clock, Data, Duration, Effect, Option } from 'effect'
import { braveKey } from './byok.ts'
import { FREE_SOURCES, type FreeSource, SOURCE_TRUST } from './catalog.ts'
import { type Hit, TIMEOUT_MS } from './polite.ts'
import { rankHits } from './rank.ts'

// parse and scrape's document route: local anydoc conversion, first in parse's
// fallback order (then Tesseract for a 'needsOcr' failure).
export { documentToMarkdown } from './documents.ts'

export type { FreeSource }

export const FREE_SOURCE_NAMES = Object.keys(FREE_SOURCES) as [FreeSource, ...FreeSource[]]

// Reddit and Bluesky answered 403 to keyless calls, so no command lists them;
// they stay callable by name for a caller that brings its own access.
const FREE_SOURCE_ORDER = {
  search: [
    'wikidata',
    'europepmc',
    'stackexchange',
    'github-search',
    'hn-algolia',
    'marginalia',
    'loc',
    'openlibrary',
  ],
  answer: [
    'wikidata',
    'wikidata-sparql',
    'stackexchange',
    'github-search',
    'hn-algolia',
    'europepmc',
    'openlibrary',
  ],
  research: [
    'europepmc',
    'ncbi-eutils',
    'crossref',
    'openalex',
    'wikidata',
    'stackexchange',
    'loc',
    'marginalia',
  ],
  summarize: ['wikidata', 'wikidata-sparql', 'hn-algolia', 'gdelt'],
  feed: ['feedsearch', 'site-feeds'],
  monitor: ['wayback-cdx', 'wayback-available'],
  map: ['wayback-cdx', 'commoncrawl-cdx'],
  crawl: ['commoncrawl-cdx', 'wayback-cdx'],
} as const satisfies Record<string, ReadonlyArray<FreeSource>>

type FreeSourceCommand = keyof typeof FREE_SOURCE_ORDER

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
const freeSourceSearch = (source: FreeSource, query: string, limit: number) =>
  FREE_SOURCES[source](query, limit).pipe(
    Effect.map((hits) =>
      hits.slice(0, limit).map((h) => ({ ...h, origin: source, trust: SOURCE_TRUST[source] })),
    ),
    Effect.mapError((cause) => new FreeSourceError({ source, cause })),
  )

// The longest command order; a command asks that many sources at once.
const MAX_SOURCES = 9

const attempt = (source: FreeSource, query: string, limit: number) =>
  freeSourceSearch(source, query, limit).pipe(
    Effect.map((hits) => ({ source, hits, error: hits.length ? '' : 'no hits' })),
    Effect.catch((e) => Effect.succeed({ source, hits: [] as Hit[], error: String(e.cause) })),
  )

// The command's order, plus Brave first for a search run that has a BYOK key.
const orderOf = (command: FreeSourceCommand): Effect.Effect<ReadonlyArray<FreeSource>> =>
  command === 'search'
    ? Effect.map(braveKey, (key) =>
        Option.isSome(key) ? ['brave', ...FREE_SOURCE_ORDER.search] : FREE_SOURCE_ORDER.search,
      )
    : Effect.succeed(FREE_SOURCE_ORDER[command])

// Ask every source routed to a command at once, rank the merged hits by trust
// and recency, and keep `limit`. Every source that failed or came back empty
// is listed in `failures`; when none answered, the run fails with all of them.
export const freeSourceFallback = (command: FreeSourceCommand, query: string, limit: number) =>
  Effect.gen(function* () {
    const ask = (s: FreeSource) => attempt(s, query, limit)
    const runs = yield* Effect.forEach(yield* orderOf(command), ask, {
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
