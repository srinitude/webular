// Contract: every run gets its own cache folder inside a fresh round folder that
// is gone after the round, and a fast byte-identical repeat is flagged cached.
import { expect, test } from 'bun:test'
import { Effect, FileSystem } from 'effect'
import {
  CACHE_SPEEDUP,
  flagCached,
  roundCacheDir,
  runCacheEnv,
  withRoundCache,
} from '../../scripts/bench/peers/cache.ts'
import type { RunRecord } from '../../scripts/bench/peers/model.ts'
import { eff, failMsg, tmpDir } from '../_support/run.ts'

test('runs 2 and 3 get their own cache folder, and --cold turns the cache off', () => {
  const dir = roundCacheDir('/b/', 'r1')
  expect(dir).toBe('/b/results/rounds/r1/cache')
  expect(runCacheEnv(dir, 2, false)).toEqual({ WEBULAR_CACHE_DIR: `${dir}/run-2` })
  expect(runCacheEnv(dir, 3, true)).toEqual({
    WEBULAR_CACHE_DIR: `${dir}/run-3`,
    WEBULAR_NO_CACHE: '1',
  })
})

test(
  'the round folder exists during the round and is gone after it',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const dir = `${yield* tmpDir('round-cache-')}/rounds/r1/cache`
      const during = yield* withRoundCache(dir, fs.exists(dir))
      expect(during).toBe(true)
      expect(yield* fs.exists(dir)).toBe(false)
    }),
  ),
)

test(
  'a round folder left from before is refused',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const dir = `${yield* tmpDir('round-cache-')}/cache`
      yield* fs.makeDirectory(dir)
      expect(yield* failMsg(withRoundCache(dir, Effect.void))).toContain('already exists')
    }),
  ),
)

const row = (run: number, latencyMs: number, outputHash = 'h'): RunRecord => ({
  provider: 'tavily',
  task: 'q1',
  job: 'search',
  run,
  status: 'ok',
  outputHash,
  metrics: { latencyMs },
})

test('a byte-identical repeat at least 5 times faster than run 1 is flagged and kept', () => {
  expect(CACHE_SPEEDUP).toBe(5)
  const out = flagCached([row(1, 500), row(2, 100), row(3, 101), row(4, 50, 'other')])
  expect(out.map((r) => r.cached)).toEqual([false, true, false, false])
  expect(out).toHaveLength(4)
})
