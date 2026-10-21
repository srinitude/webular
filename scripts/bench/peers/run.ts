// Peer benchmark entry: `mise run bench:peers` replays recordings (free,
// deterministic); `mise run bench:peers:live` calls providers, records every
// response keyed by request, and writes a dated results file and report.
// Flags: --live, --runs N (3), --peers a,b (live peers; default firecrawl,exa),
// --max-calls N (20 per peer). BENCH_PLAN points at an extra plan file.
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Clock, Config, Console, Effect, FileSystem, Layer, Ref, Schema } from 'effect'
import { FetchHttpClient } from 'effect/http'
import {
  builtinMetrics,
  type MetricDef,
  type Provider,
  RecordedOutput,
  type RunRecord,
  type Task,
} from './model.ts'
import { Peers, PeersLive } from './providers.ts'
import { recordMetrics, renderTable, sharedTasks, summarize } from './score.ts'
import { builtinTasks, loadPlan, startPages } from './tasks.ts'

const flag = (name: string) => {
  const i = Bun.argv.indexOf(`--${name}`)
  return i > 0 ? Bun.argv[i + 1] : undefined
}
const live = Bun.argv.includes('--live')
const runs = Number(flag('runs') ?? 3)
const livePeers = new Set(['webular', ...(flag('peers') ?? 'firecrawl,exa').split(',')])
const maxCalls = Number(flag('max-calls') ?? 20)
const root = new URL('../../../bench/', import.meta.url).pathname

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
    )
    const result = yield* once.pipe(Effect.retry({ times: 1 }), Effect.result)
    const latencyMs = (yield* Clock.currentTimeMillis) - t0
    if (result._tag === 'Failure')
      return { status: 'error', message: result.failure.message } as Recording
    const output = { ...result.success, latencyMs, attempts: yield* Ref.get(attempts) }
    return { status: 'ok', output } as Recording
  })

// Fresh call (local fixture, or a live peer within budget) or a replay.
const obtain = (p: Provider, task: Task, run: number, ctx: Ctx) =>
  Effect.gen(function* () {
    const key = { p: p.id, job: task.job, task: task.id, input: task.input, run }
    const file = `${root}recordings/${sha(key)}.json`
    if (task.localOnly || (live && livePeers.has(p.id))) {
      const used = yield* Ref.getAndUpdate(ctx.calls, (m) => ({ ...m, [p.id]: (m[p.id] ?? 0) + 1 }))
      if (!p.local && (used[p.id] ?? 0) >= maxCalls) return 'budget' as const
      const rec = yield* callLive(p, task, ctx.origin)
      if (!task.localOnly) yield* ctx.fs.writeFileString(file, JSON.stringify(rec))
      return rec
    }
    if (!(yield* ctx.fs.exists(file))) return undefined
    const text = yield* ctx.fs.readFileString(file)
    return yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Recording))(text)
  })

const skipReason = (p: Provider, task: Task) =>
  p.skip
    ? (['skipped', p.skip] as const)
    : !p.jobs[task.job]
      ? (['unsupported', `no ${task.job} API`] as const)
      : task.localOnly && !p.local
        ? (['unsupported', 'local fixture unreachable from a hosted API'] as const)
        : undefined

const runOne = (p: Provider, task: Task, run: number, ctx: Ctx) =>
  Effect.gen(function* () {
    const base = { provider: p.id, task: task.id, job: task.job, run, metrics: {} }
    const why = skipReason(p, task)
    if (why) return { ...base, status: why[0], note: why[1] } satisfies RunRecord
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
    return { ...base, status: 'ok', outputHash, metrics } satisfies RunRecord
  })

const statusLines = (providers: readonly Provider[], records: readonly RunRecord[]) =>
  providers.map((p) => {
    const counts: Record<string, number> = {}
    for (const r of records) if (r.provider === p.id) counts[r.status] = (counts[r.status] ?? 0) + 1
    return `  ${p.id}: ${JSON.stringify(counts)}${p.skip ? ` (${p.skip})` : ''}`
  })

const report = (
  providers: readonly Provider[],
  records: readonly RunRecord[],
  defs: readonly MetricDef[],
  note: string,
) => {
  const [web] = providers.filter((p) => p.id === 'webular')
  if (!web) return 'no webular provider'
  const ran = (p: Provider) =>
    records.some((r) => r.provider === p.id && (r.status === 'ok' || r.status === 'error'))
  const mode = live ? 'live' : 'offline replay'
  const parts = [`peer benchmark (${mode}, ${runs} runs; ${note})`, 'status per provider:']
  parts.push(...statusLines(providers, records))
  parts.push(renderTable('webular, every task', summarize(records, [web], defs), defs))
  for (const p of providers.filter((x) => x.id !== 'webular' && ran(x))) {
    const shared = sharedTasks(records, ['webular', p.id])
    const title = `webular vs ${p.id} on ${shared.size} shared tasks`
    parts.push(renderTable(title, summarize(records, [web, p], defs, shared), defs))
  }
  const misses = records.filter(
    (r) => r.provider === 'webular' && r.run === 1 && r.metrics['accuracy'] === 0,
  )
  parts.push('webular misses (run 1):')
  parts.push(...misses.map((r) => `  ${r.task}: ${r.status} ${(r.note ?? '').slice(0, 160)}`))
  return parts.join('\n\n')
}

const main = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const providers = yield* Peers
  const planPath = yield* Config.String('BENCH_PLAN').pipe(
    Config.withDefault(`${root}benchmark-plan.json`),
  )
  const plan = yield* loadPlan(planPath)
  const tasks = [...builtinTasks, ...plan.tasks]
  const defs = [...builtinMetrics, ...plan.metrics]
  yield* fs.makeDirectory(`${root}recordings`, { recursive: true })
  const pages = yield* startPages()
  const calls = yield* Ref.make<Record<string, number>>({})
  const ctx: Ctx = { fs, calls, origin: pages.origin, planMetrics: plan.metrics }
  const work = Array.from({ length: runs }, (_, i) => tasks.map((t) => [t, i + 1] as const)).flat()
  const perProvider = yield* Effect.forEach(
    providers,
    (p) => Effect.forEach(work, ([t, run]) => runOne(p, t, run, ctx), { concurrency: 1 }),
    { concurrency: providers.length },
  )
  const records = perProvider.flat()
  const text = report(providers, records, defs, plan.note)
  yield* Console.log(text)
  if (!live) return
  const stamp = new Date(yield* Clock.currentTimeMillis).toISOString().replace(/[:.]/g, '-')
  yield* fs.makeDirectory(`${root}results`, { recursive: true })
  yield* fs.writeFileString(`${root}results/peers-${stamp}.json`, JSON.stringify({ runs, records }))
  yield* fs.writeFileString(`${root}results/peers-${stamp}.txt`, `${text}\n`)
})

const layer = PeersLive.pipe(
  Layer.provideMerge(Layer.mergeAll(FetchHttpClient.layer, BunServices.layer)),
)
BunRuntime.runMain(main.pipe(Effect.scoped, Effect.provide(layer)))
