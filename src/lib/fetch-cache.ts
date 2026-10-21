// Bounded bun:sqlite validator cache for conditional GETs.

import type { Reply } from './fetch-types.ts'
import { openSqlite } from './sqlite-open.ts'

export interface Validator {
  readonly etag: string | null
  readonly last_modified: string | null
  readonly body: string
}

// url is the primary key, so lookup is O(log n) on the B-tree; `used` is
// indexed, so eviction is O(log n + evicted). Rows stay at most `rows`.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS validators (url TEXT PRIMARY KEY, etag TEXT, last_modified TEXT,
     body TEXT NOT NULL, used INTEGER NOT NULL)`,
  'CREATE INDEX IF NOT EXISTS validators_used ON validators (used)',
]
// LRU-ish: drop every row whose `used` is at or below the (rows+1)-th largest.
const EVICT_SQL =
  'DELETE FROM validators WHERE used <= (SELECT used FROM validators ORDER BY used DESC LIMIT 1 OFFSET ?)'

export const openCache = (path: string, rows: number) => {
  const db = openSqlite(path, true)
  for (const sql of SCHEMA) db.run(sql)
  let tick = (db.query('SELECT COALESCE(MAX(used), 0) AS m FROM validators').get() as { m: number })
    .m
  const get = db.query('SELECT etag, last_modified, body FROM validators WHERE url = ?')
  const touch = db.query('UPDATE validators SET used = ? WHERE url = ?')
  const put = db.query('INSERT OR REPLACE INTO validators VALUES (?, ?, ?, ?, ?)')
  const evict = db.query(EVICT_SQL)
  const lookup = (url: string) => {
    const row = get.get(url) as Validator | null
    if (row) touch.run(++tick, url)
    return row
  }
  const store = (url: string, r: Reply) => {
    put.run(url, r.headers['etag'] ?? null, r.headers['last-modified'] ?? null, r.body, ++tick)
    evict.run(rows)
  }
  return { db, lookup, store }
}
