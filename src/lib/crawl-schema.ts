// SQLite schema for the crawl frontier and resume state.
import type { Database } from 'bun:sqlite'

const SCHEMA = [
  'PRAGMA journal_mode = WAL',
  'PRAGMA synchronous = NORMAL',
  'CREATE TABLE IF NOT EXISTS crawl_seen (token TEXT, url TEXT, PRIMARY KEY (token, url)) WITHOUT ROWID',
  'CREATE TABLE IF NOT EXISTS crawl_spill (seq INTEGER PRIMARY KEY, token TEXT NOT NULL, url TEXT NOT NULL, priority INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS crawl_spill_token ON crawl_spill (token, seq)',
  'CREATE TABLE IF NOT EXISTS crawl_runs (token TEXT PRIMARY KEY, origins TEXT NOT NULL)',
  // Resume state: SimHash halves, adaptive host delays, and the robots cache.
  'CREATE TABLE IF NOT EXISTS crawl_fingerprints (token TEXT NOT NULL, lo INTEGER NOT NULL, hi INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS crawl_fingerprints_token ON crawl_fingerprints (token)',
  'CREATE TABLE IF NOT EXISTS crawl_delays (token TEXT, host TEXT, ms REAL NOT NULL, PRIMARY KEY (token, host)) WITHOUT ROWID',
  'CREATE TABLE IF NOT EXISTS crawl_robots (token TEXT, origin TEXT, rules TEXT NOT NULL, at REAL NOT NULL, PRIMARY KEY (token, origin)) WITHOUT ROWID',
]
export const initSchema = (db: Database) => {
  for (const sql of SCHEMA) db.run(sql)
}
