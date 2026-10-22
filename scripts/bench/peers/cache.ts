// Round cache rules (bench/spec/spec-integrity-and-report.md, per-round cache;
// spec-grading-and-stats.md, cache detection). Each round owns
// bench/results/rounds/<round-id>/cache, which must not exist before the round
// and is removed after it. Each run gets its own subdirectory, so runs 2 and 3
// never read run 1's cache. A repeat that returns byte-identical output at
// least CACHE_SPEEDUP times faster than the run-1 call is flagged `cached`.
import { env } from 'node:process'
import { Effect, FileSystem } from 'effect'
import { BenchError, type RunRecord } from './model.ts'

// Spec value: spec-grading-and-stats.md, "Cache detection" (at least 5 times faster).
export const CACHE_SPEEDUP = 5

export const roundCacheDir = (benchRoot: string, roundId: string) =>
  `${benchRoot}results/rounds/${roundId}/cache`

export const runCacheEnv = (dir: string, run: number, cold: boolean) => ({
  WEBULAR_CACHE_DIR: `${dir}/run-${run}`,
  ...(cold ? { WEBULAR_NO_CACHE: '1' } : {}),
})

// ponytail: webular runs in-process and its own Config reads the environment,
// so this writes the env; steps run one at a time. Upgrade: one process per arm.
export const useRunCache = (dir: string, run: number, cold: boolean) =>
  Effect.sync(() => Object.assign(env, runCacheEnv(dir, run, cold)))

export const withRoundCache = <A, E, R>(dir: string, use: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    if (yield* fs.exists(dir))
      return yield* Effect.fail(new BenchError({ message: `round cache ${dir} already exists` }))
    return yield* Effect.acquireUseRelease(
      fs.makeDirectory(dir, { recursive: true }),
      () => use,
      () => fs.remove(dir, { recursive: true }).pipe(Effect.ignore),
    )
  })

const key = (r: RunRecord) => `${r.provider}\u0000${r.task}`

const isCached = (r: RunRecord, first: RunRecord | undefined) => {
  const ms = r.metrics['latencyMs']
  const coldMs = first?.metrics['latencyMs']
  if (r.run === 1 || r.status !== 'ok' || ms === undefined || coldMs === undefined) return false
  return (
    r.outputHash !== undefined && r.outputHash === first?.outputHash && ms * CACHE_SPEEDUP <= coldMs
  )
}

// Flagged rows stay in the results; the headline reads cold rows only.
export const flagCached = (records: readonly RunRecord[]) => {
  const cold = new Map<string, RunRecord>()
  for (const r of records) if (r.run === 1 && r.status === 'ok') cold.set(key(r), r)
  return records.map((r) => ({ ...r, cached: isCached(r, cold.get(key(r))) }))
}
