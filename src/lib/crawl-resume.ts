// Crawl setup and resume: opens the database, starts or reloads a run, and
// restores its fingerprints, host delays, and robots cache.
import type { Database } from 'bun:sqlite'
import { Effect, Random } from 'effect'
import { attempt, CrawlError, type Frontier } from './crawl-frontier.ts'
import { initSchema } from './crawl-schema.ts'
import type { CrawlOptions, Run } from './crawl-types.ts'
import { emptyFingerprints, remember } from './fingerprints.ts'
import type { Robots } from './robots-txt.ts'
import { closeSqlite, openSqlite } from './sqlite-open.ts'

export const openDb = (path: string) =>
  Effect.acquireRelease(
    attempt(() => {
      const db = openSqlite(path, true)
      initSchema(db)
      return db
    }),
    (db) => Effect.sync(() => closeSqlite(db)),
  )

const startRun = (db: Database, o: CrawlOptions) =>
  Effect.flatMap(Effect.all([Random.nextInt, Random.nextInt]), ([a, b]) =>
    attempt(() => {
      const token = `crawl-${a.toString(36)}${b.toString(36)}`
      const origins = new Set((o.seeds ?? []).flatMap((s) => URL.parse(s)?.origin ?? []))
      db.query('INSERT INTO crawl_runs (token, origins) VALUES (?, ?)').run(
        token,
        [...origins].join('\n'),
      )
      return { token, origins }
    }),
  )

export const loadRun = (db: Database, o: CrawlOptions) =>
  o.resume === undefined
    ? startRun(db, o)
    : Effect.flatMap(
        attempt(() =>
          db.query('SELECT origins FROM crawl_runs WHERE token = ?').get(o.resume ?? ''),
        ),
        (row) =>
          row
            ? Effect.succeed({
                token: o.resume as string,
                origins: new Set((row as { origins: string }).origins.split('\n')),
              })
            : Effect.fail(new CrawlError({ cause: `unknown resume token ${o.resume}` })),
      )

type FingerprintRow = { lo: number; hi: number }
type DelayRow = { host: string; ms: number }
type RobotsRow = { origin: string; rules: string; at: number }

// Reads one run's resume state: O(pages + hosts + origins) time and memory.
export const restore = (r: Run) =>
  attempt(() => {
    const q = (sql: string) => r.db.query(sql).all(r.token)
    for (const f of q('SELECT lo, hi FROM crawl_fingerprints WHERE token = ?') as FingerprintRow[])
      remember(r.fingerprints, f.lo, f.hi)
    for (const d of q('SELECT host, ms FROM crawl_delays WHERE token = ?') as DelayRow[])
      r.delays.set(d.host, d.ms)
    for (const b of q('SELECT origin, rules, at FROM crawl_robots WHERE token = ?') as RobotsRow[])
      r.robots.set(b.origin, { rules: JSON.parse(b.rules) as Robots, at: b.at })
  })

export const newRun = (
  o: CrawlOptions,
  db: Database,
  frontier: Frontier,
  origins: Set<string>,
  token: string,
  now: () => number,
): Run => ({
  o,
  db,
  token,
  frontier,
  origins,
  robots: new Map(),
  delays: new Map(),
  fingerprints: emptyFingerprints(),
  result: { pages: [], skipped: [], resumeToken: token, done: false },
  now: o.now ?? now,
  sleep: o.sleep ?? ((ms) => Effect.sleep(ms)),
  visits: 0,
  inFlight: 0,
})
