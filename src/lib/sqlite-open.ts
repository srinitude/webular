// Shared SQLite open and close: a busy timeout so writers wait instead of failing,
// WAL only where a store already uses it, and PRAGMA optimize before close.
import { Database } from 'bun:sqlite'

export const openSqlite = (path: string, wal: boolean) => {
  const db = new Database(path, { create: true })
  db.run('PRAGMA busy_timeout = 5000')
  if (wal) {
    db.run('PRAGMA journal_mode = WAL')
    db.run('PRAGMA synchronous = NORMAL')
  }
  return db
}

export const closeSqlite = (db: Database) => {
  db.run('PRAGMA optimize')
  db.close()
}
