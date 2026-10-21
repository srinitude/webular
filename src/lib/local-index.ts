// Local search index owned by webular: SQLite FTS5 (BM25 ranking) on
// bun:sqlite, 64-bit SimHash near-duplicate filtering, and reciprocal rank
// fusion so the search step can merge local hits with web hits in one call.
// Pages are ranked whole (page-level BM25); each returned hit is split at its
// headings to give its best section.
import type { Database } from 'bun:sqlite'
import { Config, Effect, type Scope } from 'effect'
import { emptyFingerprints, type Fingerprints, isNearDuplicate, remember } from './fingerprints.ts'
import { bestChunk, queryTerms } from './local-chunks.ts'
import { LocalIndexError, localIndexPath } from './local-index-path.ts'
import { halves, simhash64 } from './simhash.ts'
import { closeSqlite, openSqlite } from './sqlite-open.ts'

export interface IndexedPage {
  readonly url: string
  readonly title: string
  readonly text: string
}

interface LocalHit {
  readonly url: string
  readonly title: string
  readonly description: string
  readonly score: number
  /** Heading path of the best matching chunk ('' for the page lead); absent when no chunk shares a query word. */
  readonly section?: string
}

export interface LocalIndex extends Fingerprints {
  readonly db: Database
}

const attempt = <A>(run: () => A) =>
  Effect.try({ try: run, catch: (cause) => new LocalIndexError({ cause }) })

const SCHEMA = [
  `CREATE VIRTUAL TABLE IF NOT EXISTS pages USING fts5(
     url UNINDEXED, title, body, tokenize = 'porter unicode61')`,
  'CREATE TABLE IF NOT EXISTS signatures (url TEXT PRIMARY KEY, simhash TEXT NOT NULL)',
]

const load = (path: string): LocalIndex => {
  const db = openSqlite(path, true)
  for (const sql of SCHEMA) db.run(sql)
  const rows = db.query('SELECT simhash FROM signatures').all() as { simhash: string }[]
  const index: LocalIndex = { db, ...emptyFingerprints() }
  for (const r of rows) remember(index, ...halves(BigInt(`0x${r.simhash}`)))
  return index
}

/** Opens (or creates) the index; the Scope closes the database. */
export const openLocalIndex = (
  path: string,
): Effect.Effect<LocalIndex, LocalIndexError, Scope.Scope> =>
  Effect.acquireRelease(
    attempt(() => load(path)),
    (index) => Effect.sync(() => closeSqlite(index.db)),
  )

interface AddResult {
  readonly added: number
  readonly duplicates: number
}

const insertAll = (index: LocalIndex, pages: ReadonlyArray<IndexedPage>): AddResult => {
  const known = index.db.query('SELECT 1 FROM signatures WHERE url = ?')
  const page = index.db.query('INSERT INTO pages (url, title, body) VALUES (?, ?, ?)')
  const sign = index.db.query('INSERT INTO signatures (url, simhash) VALUES (?, ?)')
  let added = 0
  index.db.transaction(() => {
    for (const p of pages) {
      const sig = simhash64(`${p.title} ${p.text}`)
      const [lo, hi] = halves(sig)
      if (known.get(p.url) || isNearDuplicate(index, lo, hi)) continue
      page.run(p.url, p.title, p.text)
      sign.run(p.url, sig.toString(16))
      remember(index, lo, hi)
      added++
    }
  })()
  return { added, duplicates: pages.length - added }
}

/** Adds pages in one transaction, skipping known URLs and near-duplicates. */
export const addPages = (index: LocalIndex, pages: ReadonlyArray<IndexedPage>) =>
  attempt(() => insertAll(index, pages))

/** Any-term FTS5 query: each word quoted, so user text never parses as syntax. */
const ftsQuery = (query: string): string =>
  queryTerms(query)
    .map((w) => `"${w}"`)
    .join(' OR ')

// bm25() column weights: url 0, title 5, body 1 (a BM25F-style field boost).
const SEARCH_SQL = `SELECT rowid AS id, url, title,
  snippet(pages, 2, '', '', ' … ', 24) AS description,
  bm25(pages, 0.0, 5.0, 1.0) AS rank
  FROM pages WHERE pages MATCH ? ORDER BY rank LIMIT ?`
// Bodies of the returned hits only, by rowid, in one query after the LIMIT
// (a body column in SEARCH_SQL rides through the sort for every match).
const BODIES_SQL =
  'SELECT rowid AS id, body FROM pages WHERE rowid IN (SELECT value FROM json_each(?))'

/** Page-level BM25 hits, best first, each with its best heading chunk. Empty query gives no hits. */
export const searchLocal = (index: LocalIndex, query: string, limit: number) =>
  attempt((): LocalHit[] => {
    const match = ftsQuery(query)
    if (!match) return []
    const rows = index.db.query(SEARCH_SQL).all(match, limit) as {
      id: number
      url: string
      title: string
      description: string
      rank: number
    }[]
    if (rows.length === 0) return []
    const ids = JSON.stringify(rows.map((r) => r.id))
    const bodies = index.db.query(BODIES_SQL).all(ids) as { id: number; body: string }[]
    const bodyOf = new Map(bodies.map((b) => [b.id, b.body]))
    const terms = queryTerms(query)
    return rows.map(({ id, rank, ...r }) => ({
      ...r,
      score: -rank,
      ...bestChunk(bodyOf.get(id) ?? '', terms),
    }))
  })

/**
 * Reciprocal rank fusion (Cormack, Clarke, Buettcher, SIGIR 2009), k = 60.
 * Merges ranked lists by URL; the first list to hold a URL supplies its item.
 * Ties keep first-seen order, so output is deterministic.
 */
export const fuseRanked = <T extends { readonly url: string }>(
  lists: ReadonlyArray<ReadonlyArray<T>>,
  k = 60,
): T[] => {
  const merged = new Map<string, { item: T; score: number }>()
  for (const list of lists) {
    list.forEach((item, rank) => {
      const entry = merged.get(item.url)
      const gain = 1 / (k + rank + 1)
      if (entry) entry.score += gain
      else merged.set(item.url, { item, score: gain })
    })
  }
  return [...merged.values()].sort((a, b) => b.score - a.score).map((e) => e.item)
}

const PRIVATE_HOST =
  /^(localhost|\[::1\]|.*\.local|127(\.\d+){3}|10(\.\d+){3}|192\.168(\.\d+){2}|169\.254(\.\d+){2}|172\.(1[6-9]|2\d|3[01])(\.\d+){2})$/

const originOf = (url: string) => (URL.canParse(url) ? new URL(url).origin : '')

/**
 * Drops hits on loopback or private hosts (bench fixtures must not answer web
 * queries) unless the query names that host or the hit is on the configured
 * local source origin, WEBULAR_SOURCE_ORIGIN, that exact origin only.
 */
export const dropPrivateHosts = <T extends { readonly url: string }>(query: string, hits: T[]) =>
  Config.String('WEBULAR_SOURCE_ORIGIN').pipe(
    Config.withDefault(''),
    Effect.orDie,
    Effect.map((source) => {
      const allowed = originOf(source)
      const q = query.toLowerCase()
      return hits.filter(({ url }) => {
        const host = URL.canParse(url) ? new URL(url).hostname : ''
        if (!PRIVATE_HOST.test(host)) return true
        if (allowed !== '' && originOf(url) === allowed) return true
        return q.includes(host.replace(/^\[|\]$/g, ''))
      })
    }),
  )

/** The search step's local list for fuseRanked: {title, url, description}; empty on any index error. */
export const searchLocalIndex = (query: string, limit: number) =>
  Effect.scoped(
    Effect.gen(function* () {
      const index = yield* openLocalIndex(yield* localIndexPath)
      const hits = yield* searchLocal(index, query, limit)
      return hits.map(({ title, url, description }) => ({ title, url, description }))
    }),
  ).pipe(Effect.orElseSucceed(() => []))
