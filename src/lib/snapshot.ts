// SNAPSHOT store — sqlite-backed page snapshot storage with unified diff.
// Uses bun:sqlite (built-in) and the FOSS `diff` package.
import { Database } from 'bun:sqlite'
import { createHash } from 'node:crypto'
import { createTwoFilesPatch } from 'diff'

export type ChangeStatus = 'new' | 'same' | 'changed'

export interface SnapshotResult {
  url: string
  changeStatus: ChangeStatus
  diff?: string
}

interface SnapshotRow {
  hash: string
  text: string
}

const SELECT = 'SELECT hash, text FROM snapshots WHERE url = ?'
const INSERT = 'INSERT INTO snapshots (url, hash, text, ts) VALUES (?, ?, ?, ?)'
const UPDATE = 'UPDATE snapshots SET hash = ?, text = ?, ts = ? WHERE url = ?'

function openDb(dbPath: string): Database {
  const db = new Database(dbPath, { create: true })
  db.run(
    'CREATE TABLE IF NOT EXISTS snapshots (url TEXT PRIMARY KEY, hash TEXT, text TEXT, ts INTEGER)',
  )
  return db
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

function compareInTx(db: Database, url: string, text: string): SnapshotResult {
  const hash = sha256(text)
  const row = db.query<SnapshotRow, string>(SELECT).get(url)
  if (!row) {
    db.run(INSERT, [url, hash, text, Date.now()])
    return { url, changeStatus: 'new' }
  }
  if (row.hash === hash) return { url, changeStatus: 'same' }
  const diff = createTwoFilesPatch(url, url, row.text, text, 'previous', 'current')
  db.run(UPDATE, [hash, text, Date.now(), url])
  return { url, changeStatus: 'changed', diff }
}

export function compareAndStore(dbPath: string, url: string, text: string): SnapshotResult {
  const db = openDb(dbPath)
  try {
    return db.transaction(() => compareInTx(db, url, text)).immediate()
  } finally {
    db.close()
  }
}
