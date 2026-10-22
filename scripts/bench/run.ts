// Bench runner. `--replay <dir>` reads recordings only (no network), checks
// them, and prints rows as JSON lines. `--config <file> --tasks <file> --out
// <dir> --commit <sha>` runs live: per round a fresh cache dir, a seeded ABBA
// order, one child process per provider call, cold then warm, both settings.
import { loadavg } from 'node:os'
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Clock, Console, Data, Effect, FileSystem, Hash, Schema } from 'effect'
import { runProc } from '../../src/core/proc.ts'
import { BUST_PARAM, coldProblems, rowsWithPrivateUrls, settingsProblems } from './guards.ts'
import { type Slot, schedule } from './order.ts'
import { readRecordings, rowSetProblems, writeRecording } from './recordings.ts'
import { type Row, RunConfig, Task } from './schema.ts'
import { type Adapter, readRequests, type Settings, WorkerOut } from './worker-io.ts'

class RunError extends Data.TaggedError('RunError')<{ readonly message: string }> {}

const fail = (message: string) => Effect.fail(new RunError({ message }))

// Every guard a recorded or live row set must pass before it is used.
export const rowProblems = (rows: ReadonlyArray<Row>) =>
  [rowsWithPrivateUrls, coldProblems, settingsProblems, rowSetProblems].flatMap((g) => g(rows))

const guard = (rows: ReadonlyArray<Row>) => {
  const problems = rowProblems(rows)
  return problems.length > 0 ? fail(problems.join('\n')) : Effect.succeed(rows)
}

export const replay = (dir: string) =>
  readRecordings(dir).pipe(
    Effect.flatMap(guard),
    Effect.tap((rows) => Console.log(rows.map((r) => JSON.stringify(r)).join('\n'))),
  )

// The round's cache dir must not exist yet; it is removed when the scope ends.
export const roundCache = (dir: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    if (yield* fs.exists(dir))
      return yield* fail(`cache dir ${dir} already exists; a round never reuses one`)
    return yield* Effect.acquireRelease(
      fs.makeDirectory(dir, { recursive: true }).pipe(Effect.as(dir)),
      () => fs.remove(dir, { recursive: true }).pipe(Effect.ignore),
    )
  })

const bustQuery = (query: string, nonce: string) => `${query} ${BUST_PARAM}${nonce}`

// Worker side: runs one adapter call in its own process and prints the result.
const worker = (provider: string, settings: Settings, query: string) =>
  Effect.gen(function* () {
    const mod = yield* Effect.tryPromise(
      () => import(`./peers/${provider}.ts`) as Promise<{ adapter: Adapter }>,
    )
    const cpu = process.cpuUsage()
    const start = yield* Clock.currentTimeMillis
    const res = yield* mod.adapter.run(query, settings)
    const used = process.cpuUsage(cpu)
    const latencyMs = (yield* Clock.currentTimeMillis) - start
    yield* Console.log(
      JSON.stringify({ ...res, latencyMs, cpuMs: (used.user + used.system) / 1000 }),
    )
  })

interface Call {
  readonly cfg: RunConfig
  readonly task: Task
  readonly provider: string
  readonly settings: Settings
  readonly phase: 'cold' | 'warm'
  readonly round: string
  readonly cache: string
  readonly commit: string
}

const callOnce = (c: Call, query: string) => {
  const log = `${c.cache}/requests.jsonl`
  return FileSystem.FileSystem.pipe(
    Effect.flatMap((fs) => fs.remove(log).pipe(Effect.ignore)),
    Effect.andThen(
      runProc(['bun', import.meta.path, '--worker', c.provider, c.settings, query], {
        timeoutMs: c.cfg.timeoutMs,
        extendEnv: true,
        env: {
          WEBULAR_CACHE_DIR: c.cache,
          WEBULAR_NO_CACHE: c.phase === 'cold' ? '1' : '0',
          WEBULAR_REQUEST_LOG: log,
        },
      }),
    ),
    Effect.flatMap((r) =>
      r.code === 0 ? Effect.succeed(r.stdout) : fail(`${c.provider}: exit ${r.code}`),
    ),
    Effect.flatMap((out) =>
      Schema.decodeUnknownEffect(Schema.fromJsonString(WorkerOut))(out.trim()),
    ),
    Effect.flatMap((out) => Effect.map(readRequests(log), (requests) => ({ ...out, requests }))),
  )
}

// Results are cut to the same count for every provider after the call.
const toRow = (
  c: Call,
  query: string,
  out: typeof WorkerOut.Type & { requests: Row['requests'] },
): Row => {
  const settingsHash = String(Hash.string(`${c.provider}|${c.settings}|${out.requestBody}`) >>> 0)
  const { provider, commit, round, settings, phase, task } = c
  return {
    key: { provider, taskId: task.id, run: 0, commit, settingsHash, date: round.slice(0, 10) },
    family: task.family,
    round,
    settings,
    phase,
    query,
    requestBody: out.requestBody,
    output: out.results.slice(0, c.cfg.resultCount).join('\n'),
    status: out.status,
    latencyMs: out.latencyMs,
    cached: out.cached,
    loadAvg: loadavg()[0] ?? 0,
    cpuMs: out.cpuMs,
    calls: out.calls,
    requests: out.requests,
  }
}

const callRow = (c: Call) => {
  const query =
    c.phase === 'cold' ? bustQuery(c.task.input, `${c.round}-${c.task.id}`) : c.task.input
  return callOnce(c, query).pipe(
    Effect.retry({ times: c.cfg.retries }),
    Effect.map((out) => toRow(c, query, out)),
  )
}

// Each scheduled slot runs at both settings, cold first, then warm.
const expand = (slots: ReadonlyArray<Slot>) =>
  slots.flatMap((s) =>
    (['default', 'best'] as const).flatMap((settings) =>
      (['cold', 'warm'] as const).map((phase) => ({ ...s, settings, phase })),
    ),
  )

// ponytail: rows run one at a time so latency is not shared; add concurrency
// levels (1, 4, 16) as a separate pass when the report needs throughput.
const runRound = (
  cfg: RunConfig,
  tasks: ReadonlyArray<Task>,
  round: string,
  commit: string,
  out: string,
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const cache = yield* roundCache(`bench/rounds/${round}/cache`)
      const byId = new Map(tasks.map((t) => [t.id, t]))
      const calls = expand(schedule(cfg.seed + round.length, [...byId.keys()], cfg.providers))
      const rows = yield* Effect.forEach(
        calls,
        (s) => callRow({ cfg, task: byId.get(s.taskId) as Task, ...s, round, cache, commit }),
        { concurrency: 1 },
      )
      yield* guard(rows)
      yield* Effect.forEach(rows, (r) => writeRecording(out, r), { concurrency: 1, discard: true })
    }),
  )

const readJson = <S extends Schema.Top>(schema: S, file: string) =>
  FileSystem.FileSystem.pipe(
    Effect.flatMap((fs) => fs.readFileString(file)),
    Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(schema))),
  )

const flag = (args: ReadonlyArray<string>, name: string) => args[args.indexOf(name) + 1] ?? ''

const live = (args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const cfg = yield* readJson(RunConfig, flag(args, '--config'))
    const tasks = yield* readJson(Schema.Array(Task), flag(args, '--tasks'))
    for (let i = 0; i < cfg.rounds; i++) {
      const now = yield* Clock.currentTimeMillis
      const round = `${new Date(now).toISOString().slice(0, 10)}-r${i}-${now}`
      yield* runRound(cfg, tasks, round, flag(args, '--commit'), flag(args, '--out'))
    }
  })

const main = (args: ReadonlyArray<string>) => {
  if (args[0] === '--replay') return replay(args[1] ?? '')
  if (args[0] === '--worker')
    return worker(args[1] ?? '', args[2] === 'best' ? 'best' : 'default', args[3] ?? '')
  return live(args)
}

if (import.meta.main)
  BunRuntime.runMain(main(process.argv.slice(2)).pipe(Effect.provide(BunServices.layer)))
