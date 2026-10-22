// `bun tests/models/tracks-dry-run.ts [record.json]`: the offline dry run of
// the agent and grader tracks. It reads a recorded track record (the fixture
// under fixtures/tracks by default), runs guard rules 26 to 31, and prints the
// agent-track table per model and arm plus the grader-track kappas.
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Console, Effect, FileSystem, Schema } from 'effect'
import { ROOT } from '../_support/root.ts'
import {
  armKey,
  graderCrossCheck,
  humanAudit,
  oneWebToolPerArm,
  runRecordsComplete,
  sameArmConditions,
  TrackRecord,
  type TrackRow,
  threeModelsRan,
} from './guards.ts'
import { allowedTools } from './run.ts'
import type { Surface } from './scenarios.ts'

const ownTools = (a: { surface: string; provider: string }) =>
  a.provider.startsWith('webular') ? allowedTools(a.surface as Surface) : [`mcp__${a.provider}`]

export const guardProblems = (t: TrackRecord) => ({
  'three models ran': threeModelsRan(t),
  'one web tool per arm': oneWebToolPerArm(t, ownTools),
  'same arm conditions': sameArmConditions(t),
  'run records complete': runRecordsComplete(t),
  'grader cross-check': graderCrossCheck(t),
  'human audit': humanAudit(t),
})

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(xs.length, 1)

// pass^k: the share of tasks where every repeat passed.
export const armStats = (rows: readonly TrackRow[]) => {
  const tasks = Map.groupBy(rows, (r) => r.task)
  const passes = rows.filter((r) => r.pass).length
  const cost = rows.reduce((a, r) => a + (r.costUsd ?? 0), 0)
  return {
    n: rows.length,
    passRate: passes / rows.length,
    passK: [...tasks.values()].filter((rs) => rs.every((r) => r.pass)).length / tasks.size,
    toolCalls: mean(rows.map((r) => r.toolCalls.length)),
    turns: mean(rows.map((r) => r.turns ?? 0)),
    tokens: rows.reduce((a, r) => a + (r.inputTokens ?? 0) + (r.outputTokens ?? 0), 0),
    wallSec: mean(rows.map((r) => (r.wallMs ?? 0) / 1000)),
    costPerCorrect: passes ? cost / passes : null,
  }
}

const fmt = (x: number | null) => (x === null ? '-' : Number(x.toFixed(3)))

const main = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = process.argv[2] ?? `${ROOT}tests/models/fixtures/tracks/dry-run.json`
  const t = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(TrackRecord))(
    yield* fs.readFileString(path),
  )
  const groups = Map.groupBy(t.rows, (r) => `${r.model} ${armKey(r)}`)
  for (const [key, rows] of groups) {
    const s = armStats(rows)
    yield* Console.log(
      `${key}: n=${s.n} pass=${fmt(s.passRate)} pass^k=${fmt(s.passK)} calls=${fmt(s.toolCalls)} turns=${fmt(s.turns)} tokens=${s.tokens} wall=${fmt(s.wallSec)}s $/correct=${fmt(s.costPerCorrect)}`,
    )
  }
  for (const g of t.rubrics)
    yield* Console.log(`rubric ${g.id}: cohen=${JSON.stringify(g.cohen)} fleiss=${g.fleiss}`)
  const problems = Object.entries(guardProblems(t)).filter(([, p]) => p.length > 0)
  for (const [rule, p] of problems) yield* Console.log(`guard FAIL ${rule}: ${p.join('; ')}`)
  if (problems.length) return yield* Effect.fail(`${problems.length} guard rules broke`)
  yield* Console.log('guards 26-31 hold')
}).pipe(Effect.provide(BunServices.layer))

if (import.meta.main) BunRuntime.runMain(main)
