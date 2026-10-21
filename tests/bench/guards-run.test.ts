// Guard tests 7-14 and 16 (spec-integrity-and-report.md): each builds the
// biased input and asserts its guard rejects it; one clean case passes all.
import { expect, test } from 'bun:test'
import { Effect, Exit, FileSystem, Path } from 'effect'
import {
  coldProblems,
  robotsDisallowed,
  rowsWithPrivateUrls,
  settingsProblems,
  unequalLimits,
} from '../../scripts/bench/guards.ts'
import { checkLog, schedule } from '../../scripts/bench/order.ts'
import { readRecordings, rowSetProblems, writeRecording } from '../../scripts/bench/recordings.ts'
import { roundCache, rowProblems } from '../../scripts/bench/run.ts'
import type { Row } from '../../scripts/bench/schema.ts'
import { eff, tmpDir } from '../_support/run.ts'

const FIXTURES = 'tests/bench/fixtures/recordings'
const clean = readRecordings(FIXTURES)
const withRows = (f: (rows: ReadonlyArray<Row>) => void) => eff(Effect.map(clean, f))
const edit = (rows: ReadonlyArray<Row>, i: number, patch: Partial<Row>) =>
  rows.map((r, j) => (j === i ? { ...r, ...patch } : r))
const PRIVATE = [
  'localhost:3000',
  '127.0.0.1',
  '[::1]',
  '0.0.0.0',
  '10.1.2.3',
  '172.20.0.1',
  '192.168.1.1',
  '169.254.1.1',
]

test(
  'clean fixtures pass every guard',
  withRows((rows) => {
    expect(rows.length).toBe(24)
    expect(rowProblems(rows)).toEqual([])
  }),
)

test(
  '7: a reused round cache dir fails and the dir is gone after the round',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const dir = (yield* Path.Path).join(yield* tmpDir('bench-round-'), 'cache')
      yield* Effect.scoped(roundCache(dir))
      expect(yield* fs.exists(dir)).toBe(false)
      yield* fs.makeDirectory(dir)
      expect(Exit.isFailure(yield* Effect.exit(Effect.scoped(roundCache(dir))))).toBe(true)
    }),
  ),
)

test(
  '8: a private URL in output is rejected',
  withRows((rows) => {
    for (const host of PRIVATE)
      expect(rowsWithPrivateUrls(edit(rows, 0, { output: `see http://${host}/x` })).length).toBe(1)
    expect(rowsWithPrivateUrls(edit(rows, 0, { output: 'see http://172.32.0.1/x' }))).toEqual([])
    expect(rowsWithPrivateUrls(edit(rows, 0, { output: 'see fixture://pages/a' })).length).toBe(1)
  }),
)

test(
  '9: a cold row with a cache hit or no bust variant is rejected',
  withRows((rows) => {
    const i = rows.findIndex((r) => r.phase === 'cold')
    expect(coldProblems(edit(rows, i, { cached: true })).length).toBe(1)
    expect(coldProblems(edit(rows, i, { query: 'what is t1' })).length).toBe(1)
  }),
)

test('10: a non-interleaved run log is rejected', () => {
  const providers = ['alpha', 'beta', 'gamma']
  const tasks = ['t1', 't2', 't3']
  const log = schedule(7, tasks, providers)
  expect(checkLog(log, providers)).toEqual([])
  const grouped = providers.flatMap((provider) => tasks.flatMap((taskId) => [{ taskId, provider }]))
  expect(checkLog([...grouped, ...grouped], providers).length).toBeGreaterThan(0)
  const noAbba = log.map((s, i) => (i < 6 ? (log[i % 3] ?? s) : s))
  expect(checkLog(noAbba, providers).length).toBeGreaterThan(0)
})

test('11: unequal limits are rejected', () => {
  const base = { resultCount: 10, timeoutMs: 60000, retries: 2, budgetUsd: 1 }
  expect(unequalLimits({ alpha: base, beta: base })).toEqual([])
  expect(unequalLimits({ alpha: base, beta: { ...base, resultCount: 20 } })).toEqual([
    'beta: limits differ',
  ])
})

test(
  '12: missing best settings or a missing request body is rejected',
  withRows((rows) => {
    const noBest = rows.filter((r) => !(r.key.provider === 'beta' && r.settings === 'best'))
    expect(settingsProblems(noBest).length).toBe(3)
    expect(settingsProblems(edit(rows, 0, { requestBody: '' })).length).toBe(1)
  }),
)

test(
  '13: a recording key with no commit is refused',
  eff(
    Effect.gen(function* () {
      const first = (yield* clean)[0] as Row
      const dir = yield* tmpDir('bench-rec-')
      const bad = { ...first, key: { ...first.key, commit: '' } }
      expect(Exit.isFailure(yield* Effect.exit(writeRecording(dir, bad)))).toBe(true)
      yield* writeRecording(dir, first)
      expect(yield* readRecordings(dir)).toEqual([first])
    }),
  ),
)

test(
  '14: a missing row fails the same-row-set check',
  withRows((rows) => {
    expect(rowSetProblems(rows)).toEqual([])
    expect(rowSetProblems(rows.slice(1)).length).toBe(1)
  }),
)

test('16: robots-disallowed URLs are reported', () => {
  const robots =
    'User-agent: *\nDisallow: /private\nAllow: /private/ok\n\nUser-agent: other\nDisallow: /'
  const urls = ['https://a.com/private/x', 'https://a.com/private/ok/y', 'https://a.com/public']
  expect(robotsDisallowed(robots, urls)).toEqual(['https://a.com/private/x'])
})
