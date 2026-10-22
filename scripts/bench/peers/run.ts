// Peer benchmark entry: `mise run bench:peers` replays recordings (free,
// deterministic); `mise run bench:peers:live` calls providers, records every
// response keyed by request, and writes a dated results file and report.
// Flags: --live, --runs N (3), --peers a,b (live peers; default firecrawl,exa),
// --max-calls N (20 per peer), --seed N (arm and task order; random if absent),
// --cold (WEBULAR_NO_CACHE=1), --judge (blinded LLM judge, used only once
// calibrated), --jobs a,b (run only those jobs). BENCH_PLAN points at an extra plan file.
import { fileURLToPath } from 'node:url'
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Clock, Config, Console, Effect, FileSystem, Layer, Ref, Schema } from 'effect'
import { FetchHttpClient } from 'effect/http'
import { defaultJudge } from '../judge.ts'
import { flagCached, roundCacheDir, useRunCache, withRoundCache } from './cache.ts'
import { markCase } from './cases.ts'
import { type JudgeSetup, judgedAccuracy } from './grade.ts'
import {
  builtinMetrics,
  type MetricDef,
  type Provider,
  RecordedOutput,
  type RunRecord,
  type Task,
} from './model.ts'
import { resolveSeed, schedule } from './order.ts'
import { loadPlan } from './plan.ts'
import { Peers, PeersLive } from './providers.ts'
import { livePath, replayPath } from './recording-paths.ts'
import { report } from './report.ts'
import { recordMetrics } from './score.ts'
import { skipReason } from './skip.ts'
import { builtinTasks, startPages } from './tasks.ts'
import { CALL_TIMEOUT_MS } from './timeout.ts'

const flag = (name: string) => {
  const i = Bun.argv.indexOf(`--${name}`)
  return i > 0 ? Bun.argv[i + 1] : undefined
}
const live = Bun.argv.includes('--live')
const cold = Bun.argv.includes('--cold')
const runs = Number(flag('runs') ?? 3)
const livePeers = new Set(['webular', ...(flag('peers') ?? 'firecrawl,exa').split(',')])
const maxCalls = Number(flag('max-calls') ?? 20)
const jobs = flag('jobs')?.split(',')
const root = fileURLToPath(new URL('../../../bench/', import.meta.url))

const Recording = Schema.Union([
  Schema.Struct({ status: Schema.Literal('ok'), output: RecordedOutput }),
  Schema.Struct({ status: Schema.Literal('error'), message: Schema.String }),
])
type Recording = typeof Recording.Type

const sha = (v: unknown) => new Bun.CryptoHasher('sha256').update(JSON.stringify(v)).digest('hex')

interface Ctx {
  fs: FileSystem.FileSystem
  calls: Ref.Ref<Record<string, number>>
  origin: string
  planMetrics: readonly MetricDef[]
  judge: JudgeSetup
}

const callLive = (p: Provider, task: Task, origin: string) =>
  Effect.gen(function* () {
    const job = p.jobs[task.job]
    if (!job) return { status: 'error', message: 'unsupported' } as Recording
    const url = task.input.url?.replace('{fixture}', origin)
    const attempts = yield* Ref.make(0)
    const t0 = yield* Clock.currentTimeMillis
    const once = Ref.update(attempts, (n) => n + 1).pipe(
      Effect.andThen(job({ ...task.input, ...(url === undefined ? {} : { url }) })),
      Effect.timeout(CALL_TIMEOUT_MS),
    )
    const result = yield* once.pipe(Effect.retry({ times: 1 }), Effect.result)
    const latencyMs = (yield* Clock.currentTimeMillis) - t0
    if (result._tag === 'Failure')
      return { status: 'error', message: result.failure.message } as Recording
    const output = { ...result.success, latencyMs, attempts: yield* Ref.get(attempts) }
    return { status: 'ok', output } as Recording
  })

// Fresh call (local fixture, or a live peer within budget) or a replay.
// Live recordings go under bench/results, never over checked-in bench/recordings.
const obtain = (p: Provider, task: Task, run: number, ctx: Ctx) =>
  Effect.gen(function* () {
    const key = { p: p.id, job: task.job, task: task.id, input: task.input, run }
    const file = replayPath(root, sha(key))
    if (task.localOnly || (live && livePeers.has(p.id))) {
      const used = yield* Ref.getAndUpdate(ctx.calls, (m) => ({ ...m, [p.id]: (m[p.id] ?? 0) + 1 }))
      if (!p.local && (used[p.id] ?? 0) >= maxCalls) return 'budget' as const
      const rec = yield* callLive(p, task, ctx.origin)
      if (!task.localOnly)
        yield* ctx.fs.writeFileString(livePath(root, sha(key)), JSON.stringify(rec))
      return rec
    }
    if (!(yield* ctx.fs.exists(file))) return undefined
    const text = yield* ctx.fs.readFileString(file)
    return yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Recording))(text)
  })

const runOne = (p: Provider, task: Task, run: number, ctx: Ctx) =>
  Effect.gen(function* () {
    const base = { provider: p.id, task: task.id, job: task.job, run, metrics: {} }
    const why = skipReason(p, task)
    if (why) return { ...base, status: why[0], note: why[1] } satisfies RunRecord
    if (live && p.id === 'webular') yield* markCase(ctx.fs, task.id, run)
    const rec = yield* obtain(p, task, run, ctx)
    if (rec === 'budget')
      return {
        ...base,
        status: 'skipped',
        note: `call budget ${maxCalls} spent`,
      } satisfies RunRecord
    if (!rec)
      return { ...base, status: 'unrecorded', note: 'run bench:peers:live' } satisfies RunRecord
    if (rec.status === 'error')
      return {
        ...base,
        status: 'error',
        note: rec.message,
        metrics: { accuracy: 0 },
      } satisfies RunRecord
    const outputHash = sha([rec.output.text, rec.output.urls])
    const metrics = recordMetrics(task, rec.output, ctx.planMetrics)
    metrics['answerAccuracy'] = yield* judgedAccuracy(ctx.judge, task, rec.output)
    return { ...base, status: 'ok', outputHash, metrics } satisfies RunRecord
  })

// One round: seeded ABBA order, one run at a time, each run with its own cache dir.
const runRound = (tasks: readonly Task[], providers: readonly Provider[], ctx: Ctx) =>
  Effect.gen(function* () {
    const seed = yield* resolveSeed(flag('seed'))
    const cacheDir = roundCacheDir(root, `${yield* Clock.currentTimeMillis}-${seed}`)
    const steps = yield* schedule(seed, tasks, providers, runs)
    const step = (s: (typeof steps)[number]) =>
      useRunCache(cacheDir, s.run, cold).pipe(
        Effect.andThen(runOne(s.provider, s.task, s.run, ctx)),
      )
    const ran = yield* withRoundCache(cacheDir, Effect.forEach(steps, step, { concurrency: 1 }))
    return { seed, records: flagCached(ran).map((r) => ({ ...r, seed })) }
  })

const main = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const providers = yield* Peers
  const planPath = yield* Config.String('BENCH_PLAN').pipe(
    Config.withDefault(`${root}benchmark-plan.json`),
  )
  const plan = yield* loadPlan(planPath)
  const defs = [...builtinMetrics, ...plan.metrics]
  yield* fs.makeDirectory(`${root}recordings`, { recursive: true })
  yield* fs.makeDirectory(`${root}results/recordings`, { recursive: true })
  const pages = yield* startPages()
  const calls = yield* Ref.make<Record<string, number>>({})
  const names = providers.map((p) => p.id)
  const judgeOn = Bun.argv.includes('--judge')
  const judge = { judge: judgeOn ? defaultJudge : undefined, calibration: undefined, names }
  const ctx: Ctx = { fs, calls, origin: pages.origin, planMetrics: plan.metrics, judge }
  const tasks = [...builtinTasks, ...plan.tasks].filter((t) => !jobs || jobs.includes(t.job))
  const { seed, records } = yield* runRound(tasks, providers, ctx)
  const mode = `${live ? 'live' : 'offline replay'}, ${runs} runs`
  const header = `peer benchmark (${mode}; ${plan.note}; seed ${seed}${cold ? ', cold' : ''})`
  const text = report(providers, records, defs, header)
  yield* Console.log(text)
  if (!live) return
  const stamp = new Date(yield* Clock.currentTimeMillis).toISOString().replace(/[:.]/g, '-')
  const out = `${root}results/peers-${stamp}`
  yield* fs.writeFileString(`${out}.json`, JSON.stringify({ runs, seed, records }))
  yield* fs.writeFileString(`${out}.txt`, `${text}\n`)
})

const layer = PeersLive.pipe(
  Layer.provideMerge(Layer.mergeAll(FetchHttpClient.layer, BunServices.layer)),
)
BunRuntime.runMain(main.pipe(Effect.scoped, Effect.provide(layer)))
