// Shared SQLite open: busy timeout always, WAL only on request, optimize at close.
import { expect, test } from 'bun:test'
import { Effect, Path } from 'effect'
import { closeSqlite, openSqlite } from '../../src/lib/sqlite-open.ts'
import { eff, tmpDir } from '../_support/run.ts'

const pragmas = (file: string, wal: boolean) =>
  Effect.sync(() => {
    const db = openSqlite(file, wal)
    const busy = db.query('PRAGMA busy_timeout').get() as { timeout: number }
    const mode = db.query('PRAGMA journal_mode').get() as { journal_mode: string }
    closeSqlite(db)
    return { busy: busy.timeout, mode: mode.journal_mode }
  })

test(
  'busy timeout is always set; WAL only when asked',
  eff(
    Effect.gen(function* () {
      const dir = yield* tmpDir('sqlite-pragmas-')
      const path = yield* Path.Path
      const plain = yield* pragmas(path.join(dir, 'plain.db'), false)
      const wal = yield* pragmas(path.join(dir, 'wal.db'), true)
      expect(plain.busy).toBe(5000)
      expect(plain.mode).not.toBe('wal')
      expect(wal.busy).toBe(5000)
      expect(wal.mode).toBe('wal')
    }),
  ),
)
