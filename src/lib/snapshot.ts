// SNAPSHOT store — sqlite-backed page snapshot storage with unified diff.
// Uses bun:sqlite (built-in) and the FOSS `diff` package.
import type { Database } from 'bun:sqlite'
import { createHash } from 'node:crypto'
import { createTwoFilesPatch } from 'diff'
import { Clock, Data, Effect } from 'effect'
import { errMsg } from '../core/output.ts'
import { closeSqlite, openSqlite } from './sqlite-open.ts'

type ChangeStatus = 'new' | 'same' | 'changed'

interface SnapshotResult {
  url: string
  changeStatus: ChangeStatus
  diff?: string
}

interface SnapshotRow {
  hash: string
  text: string
}

class SnapshotError extends Data.TaggedError('SnapshotError')<{ readonly message: string }> {}

const SELECT = 'SELECT hash, text FROM snapshots WHERE url = ?'
const INSERT = 'INSERT INTO snapshots (url, hash, text, ts) VALUES (?, ?, ?, ?)'
const UPDATE = 'UPDATE snapshots SET hash = ?, text = ?, ts = ? WHERE url = ?'

function openDb(dbPath: string): Database {
  const db = openSqlite(dbPath, false)
  db.run(
    'CREATE TABLE IF NOT EXISTS snapshots (url TEXT PRIMARY KEY, hash TEXT, text TEXT, ts INTEGER)',
  )
  return db
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

function compareInTx(db: Database, url: string, text: string, now: number): SnapshotResult {
  const hash = sha256(text)
  const row = db.query<SnapshotRow, string>(SELECT).get(url)
  if (!row) {
    db.run(INSERT, [url, hash, text, now])
    return { url, changeStatus: 'new' }
  }
  if (row.hash === hash) return { url, changeStatus: 'same' }
  const diff = createTwoFilesPatch(url, url, row.text, text, 'previous', 'current')
  db.run(UPDATE, [hash, text, now, url])
  return { url, changeStatus: 'changed', diff }
}

const fail = (err: unknown) => new SnapshotError({ message: errMsg(err) })

export const compareAndStore = Effect.fn('compareAndStore')(function* (
  dbPath: string,
  url: string,
  text: string,
) {
  const now = yield* Clock.currentTimeMillis
  return yield* Effect.acquireUseRelease(
    Effect.try({ try: () => openDb(dbPath), catch: fail }),
    (db) =>
      Effect.try({
        try: () => db.transaction(() => compareInTx(db, url, text, now)).immediate(),
        catch: fail,
      }),
    (db) => Effect.sync(() => closeSqlite(db)),
  )
})
