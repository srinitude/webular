// Baseline: run each scenario's reference webular call against the local
// fixture and apply the scenario's eval to that output. `bun
// tests/models/baseline.ts` records the result in scenarios.json and the raw
// output in tests/models/baseline/<id>.txt; the harness test re-runs it and
// fails when any result drifts from the record.
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Console, Effect, FileSystem, Stream } from 'effect'
import { ChildProcess, ChildProcessSpawner } from 'effect/process'
import { startFixture } from '../_support/fixture.ts'
import { ROOT } from '../_support/root.ts'
import { type Ctx, evaluate, fill, unfill } from './check.ts'
import {
  type Baseline,
  fixtureRoutes,
  loadScenarios,
  SCENARIO_PATH,
  type Scenario,
  type ScenarioFile,
  webularEnv,
} from './scenarios.ts'

const text = (s: Stream.Stream<Uint8Array, unknown>) => Stream.mkString(Stream.decodeText(s))

export const spawnText = (
  cmd: string,
  args: readonly string[],
  env: Record<string, string>,
  cwd = ROOT,
) =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const h = yield* spawner.spawn(ChildProcess.make(cmd, [...args], { cwd, env, extendEnv: true }))
    const [out, err, code] = yield* Effect.all([text(h.stdout), text(h.stderr), h.exitCode], {
      concurrency: 3,
    })
    return { out, err, code: Number(code) }
  }).pipe(Effect.scoped)

const step = (
  s: Scenario['reference'][number],
  ctx: Ctx,
  env: Record<string, string>,
): Effect.Effect<
  string,
  unknown,
  FileSystem.FileSystem | ChildProcessSpawner.ChildProcessSpawner
> =>
  'file' in s
    ? Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        return yield* fs.readFileString(`${ROOT}${s.file}`)
      })
    : spawnText(
        'bun',
        [`${ROOT}src/commands/${s[0]}.ts`, ...s.slice(1).map((a) => fill(a, ctx))],
        env,
      ).pipe(Effect.map((r) => `${r.out}${r.err}`))

const baselineOne = (file: ScenarioFile, s: Scenario, keepRaw: boolean) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const fx = yield* startFixture(fixtureRoutes(file))
    const tmp = yield* fs.makeTempDirectoryScoped()
    const ctx = { origin: fx.origin, tmp }
    const env = webularEnv(fx.origin, tmp)
    const outs = yield* Effect.forEach(s.reference, (r) => step(r, ctx, env), { concurrency: 1 })
    const raw = outs.join('\n')
    if (keepRaw)
      yield* fs.writeFileString(`${ROOT}tests/models/baseline/${s.id}.txt`, unfill(raw, ctx))
    const problems = evaluate(s.eval, raw, ctx)
    return [s.id, { pass: problems.length === 0, problems }] as const
  }).pipe(Effect.scoped)

export const runBaseline = (record: boolean) =>
  Effect.gen(function* () {
    const file = yield* loadScenarios
    const fs = yield* FileSystem.FileSystem
    if (record) yield* fs.makeDirectory(`${ROOT}tests/models/baseline`, { recursive: true })
    const rows = yield* Effect.forEach(file.scenarios, (s) => baselineOne(file, s, record), {
      concurrency: 4,
    })
    const result: Record<string, Baseline> = Object.fromEntries(rows)
    if (record) {
      const scenarios = file.scenarios.map((s) => ({ ...s, baseline: result[s.id] }))
      yield* fs.writeFileString(
        SCENARIO_PATH,
        `${JSON.stringify({ ...file, scenarios }, null, 2)}\n`,
      )
    }
    return result
  }).pipe(Effect.provide(BunServices.layer))

const report = (r: Record<string, Baseline>) =>
  Effect.forEach(
    Object.entries(r),
    ([id, b]) =>
      Console.log(
        `${b.pass ? 'pass' : 'FAIL'} ${id}${b.problems.length ? `: ${b.problems.join('; ')}` : ''}`,
      ),
    { concurrency: 1 },
  )

if (import.meta.main) BunRuntime.runMain(Effect.flatMap(runBaseline(true), report))
