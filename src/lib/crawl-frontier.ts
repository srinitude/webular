// Mercator-style crawl frontier (Manning, Raghavan, Schütze, IIR ch. 20):
// priority front queues, one FIFO back queue per host, and a min-heap of
// hosts keyed by next-allowed time. The seen set and the overflow spill live
// in SQLite, so memory stays O(memoryCap + H) however large the crawl grows.
import type { Database } from 'bun:sqlite'
import { Data, Effect } from 'effect'
import { HostHeap } from './crawl-heap.ts'
import { initSchema } from './crawl-schema.ts'

export class CrawlError extends Data.TaggedError('CrawlError')<{ readonly cause: unknown }> {}

export const attempt = <A>(run: () => A) =>
  Effect.try({ try: run, catch: (cause) => new CrawlError({ cause }) })

export const PRIORITIES = 3
export type Popped = { readonly url: string; readonly host: string } | { readonly waitMs: number }
const hostOf = (url: string) => URL.parse(url)?.host ?? ''
const emptyFront = () => Array.from({ length: PRIORITIES }, (): string[] => [])
type SpillRow = { seq: number; url: string; priority: number }

/**
 * Enqueue: O(log N) per URL for the PRIMARY KEY probe. Pop: O(log H) heap work
 * plus an amortized O(log N) share of one batch refill. Memory: at most
 * `memoryCap` URLs plus O(H) host state; the rest waits in SQLite, FIFO.
 */
export interface Frontier {
  readonly db: Database
  readonly token: string
  readonly memoryCap: number
  front: string[][]
  readonly backs: Map<string, string[]>
  readonly scheduled: Set<string> // in the heap or in flight
  readonly readyAt: Map<string, number>
  readonly heap: HostHeap
  spilled: number
  inMemory: number
  peakInMemory: number
}

export const makeFrontier = (db: Database, token: string, memoryCap: number): Frontier => {
  initSchema(db)
  const row = db.query('SELECT COUNT(*) AS n FROM crawl_spill WHERE token = ?').get(token)
  return {
    db,
    token,
    memoryCap,
    front: emptyFront(),
    backs: new Map(),
    scheduled: new Set(),
    readyAt: new Map(),
    heap: new HostHeap(),
    spilled: (row as { n: number }).n,
    inMemory: 0,
    peakInMemory: 0,
  }
}

const admit = (f: Frontier, url: string, priority: number) => {
  if (f.inMemory < f.memoryCap && f.spilled === 0) {
    ;(f.front[priority] as string[]).push(url)
    f.peakInMemory = Math.max(f.peakInMemory, ++f.inMemory)
    return
  }
  f.db
    .query('INSERT INTO crawl_spill (token, url, priority) VALUES (?, ?, ?)')
    .run(f.token, url, priority)
  f.spilled++
}

const refill = (f: Frontier) => {
  if (f.spilled === 0 || f.inMemory > f.memoryCap / 2) return
  const rows = f.db
    .query('SELECT seq, url, priority FROM crawl_spill WHERE token = ? ORDER BY seq LIMIT ?')
    .all(f.token, f.memoryCap - f.inMemory) as SpillRow[]
  const last = rows.at(-1)
  if (!last) return
  f.db.query('DELETE FROM crawl_spill WHERE token = ? AND seq <= ?').run(f.token, last.seq)
  for (const r of rows) (f.front[r.priority] as string[]).push(r.url)
  f.spilled -= rows.length
  f.inMemory += rows.length
  f.peakInMemory = Math.max(f.peakInMemory, f.inMemory)
}

// Front queues drain highest priority first into the per-host back queues.
const route = (f: Frontier) => {
  for (const queue of f.front)
    for (const url of queue) {
      const host = hostOf(url)
      const q = f.backs.get(host) ?? []
      if (q.length === 0) f.backs.set(host, q)
      q.push(url)
      if (f.scheduled.has(host)) continue
      f.scheduled.add(host)
      f.heap.push({ host, at: f.readyAt.get(host) ?? 0 })
    }
  f.front = emptyFront()
}

/** Adds unseen URLs in one transaction; returns how many were new. */
export const enqueue = (f: Frontier, urls: ReadonlyArray<string>, priority = 0) =>
  attempt(() => {
    const p = Math.min(PRIORITIES - 1, Math.max(0, priority))
    const mark = f.db.query('INSERT OR IGNORE INTO crawl_seen (token, url) VALUES (?, ?)')
    let added = 0
    f.db.transaction(() => {
      for (const url of urls) {
        if (mark.run(f.token, url).changes !== 1) continue
        admit(f, url, p)
        added++
      }
    })()
    return added
  })

/** The next URL whose host is due, the wait until one is, or null when empty. */
export const pop = (f: Frontier, now: number) =>
  attempt((): Popped | null => {
    if (f.spilled > 0 && f.inMemory <= f.memoryCap / 2) f.db.transaction(() => refill(f))()
    if (f.front.some((q) => q.length > 0)) route(f)
    const top = f.heap.items[0]
    if (!top) return null
    if (top.at > now) return { waitMs: top.at - now }
    f.heap.pop()
    const url = (f.backs.get(top.host) as string[]).shift() as string
    f.inMemory--
    return { url, host: top.host }
  })

/** Hands a popped host back, due again at `at`. */
export const release = (f: Frontier, host: string, at: number) => {
  f.readyAt.set(host, at)
  if (f.backs.get(host)?.length) return f.heap.push({ host, at })
  f.backs.delete(host)
  f.scheduled.delete(host)
}

/** Writes in-memory URLs back to SQLite ahead of the spill, keeping FIFO order. */
export const flush = (f: Frontier) =>
  attempt(() => {
    route(f)
    const pending = [...f.backs.values()].flat()
    const row = f.db.query('SELECT COALESCE(MIN(seq), 0) AS m FROM crawl_spill').get()
    const first = (row as { m: number }).m - pending.length
    const put = f.db.query(
      'INSERT INTO crawl_spill (seq, token, url, priority) VALUES (?, ?, ?, 0)',
    )
    f.db.transaction(() => {
      for (const [i, url] of pending.entries()) put.run(first + i, f.token, url)
    })()
    f.spilled += pending.length
    f.inMemory = 0
    f.backs.clear()
  })
