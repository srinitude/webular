// The per-command scoreboard: every metric that applies to every command, its
// value, the eval that measures it, and its set. Offline values come from
// scoreboard-rows.ts; live numbers come from the committed peer run with the
// highest timestamp. `mise run bench:scoreboard` writes bench/scoreboard.json and
// the block in docs/scoreboard.md; tests/bench/scoreboard.test.ts fails on drift.
import { fileURLToPath } from 'node:url'
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Console, Effect, FileSystem, Schema } from 'effect'
import { pickRun } from './peers/docs.ts'
import { runDate } from './peers/plain-words.ts'
import { APPLIES, COMMAND_LIST, OFFLINE } from './scoreboard-rows.ts'

const PeerRecord = Schema.Struct({
  provider: Schema.String,
  task: Schema.String,
  job: Schema.String,
  status: Schema.String,
  outputHash: Schema.optional(Schema.String),
  metrics: Schema.Record(Schema.String, Schema.Number),
})
type PeerRecord = typeof PeerRecord.Type
const PeerRun = Schema.fromJsonString(Schema.Struct({ records: Schema.Array(PeerRecord) }))

export interface Row {
  command: string
  metric: string
  value: number | null
  status: 'measured' | 'gap'
  eval: string | null
  set: string | null
  bestRival?: { tool: string; value: number }
  ceiling?: string
}

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const pct = (xs: readonly number[], p: number) =>
  xs.toSorted((a, b) => a - b)[Math.min(xs.length - 1, Math.ceil(p * xs.length) - 1)] ?? 0
const r4 = (x: number) => Math.round(x * 1e4) / 1e4
const m = (r: PeerRecord, k: string) => r.metrics[k] ?? 0

// One job's numbers for one tool from the peer run's ok records.
const jobMetrics = (rs: readonly PeerRecord[]): Record<string, number> => {
  const byTask = [...Map.groupBy(rs, (r) => r.task).values()]
  const wins = rs.filter((r) => m(r, 'accuracy') >= 1).length
  const cost = rs.reduce((a, r) => a + m(r, 'costUsd'), 0)
  const cite = rs.flatMap((r) => r.metrics['citationPrecision'] ?? [])
  const lat = rs.map((r) => m(r, 'latencyMs'))
  const same = (g: readonly PeerRecord[]) =>
    new Set(g.map((r) => r.outputHash)).size === 1 ? 1 : 0
  return {
    accuracy: r4(mean(byTask.map((g) => mean(g.map((r) => m(r, 'accuracy')))))),
    determinism: r4(mean(byTask.map(same))),
    'latency p50 ms': pct(lat, 0.5),
    'latency p95 ms': pct(lat, 0.95),
    'cost per success usd': wins ? r4(cost / wins) : 0,
    ...(cite.length ? { 'citation faithfulness': r4(mean(cite)) } : {}),
  }
}

type Scored = readonly (readonly [string, Record<string, number>])[]
const bestRival = (rivals: Scored, metric: string) => {
  const best = rivals.toSorted((a, b) => (b[1][metric] ?? 0) - (a[1][metric] ?? 0))[0]
  if (metric !== 'accuracy' || !best) return {}
  return { bestRival: { tool: best[0], value: best[1][metric] ?? 0 } }
}

const peerRows = (records: readonly PeerRecord[], source: string) => {
  const out = new Map<string, Row>()
  const ok = records.filter((r) => r.status === 'ok')
  for (const [job, rs] of Map.groupBy(ok, (r) => r.job)) {
    const byTool = Map.groupBy(rs, (r) => r.provider)
    const ours = byTool.get('webular')
    if (!ours) continue
    const rivals: Scored = [...byTool]
      .filter(([t]) => t !== 'webular')
      .map(([t, g]) => [t, jobMetrics(g)] as const)
    for (const [metric, value] of Object.entries(jobMetrics(ours)))
      out.set(`${job}|${metric}`, {
        ...{ command: job, metric, value, status: 'measured', eval: source, set: 'peer dev' },
        ...bestRival(rivals, metric),
      })
  }
  return out
}

export const buildRows = (records: readonly PeerRecord[], source: string): Row[] => {
  const peers = peerRows(records, source)
  return COMMAND_LIST.flatMap((command) =>
    APPLIES[command].map((metric): Row => {
      const off = OFFLINE[command]?.[metric]
      const gap: Row = { command, metric, value: null, status: 'gap', eval: null, set: null }
      if (!off) return peers.get(`${command}|${metric}`) ?? gap
      const { value, ceiling, ...where } = off
      return {
        ...gap,
        ...where,
        value: r4(value),
        status: 'measured',
        ...(ceiling ? { ceiling } : {}),
      }
    }),
  )
}

const fmt = (v: number | null) =>
  v === null ? 'gap' : Number.isInteger(v) && v > 1 ? String(v) : v.toFixed(4)
// A results file shows as its run date in words; a test file keeps its path.
const evalLink = (e: string) =>
  e.startsWith('bench/results/') ? `[peer run from ${runDate(e)}](../${e})` : `[\`${e}\`](../${e})`
const against = (r: Row) => {
  if (!r.bestRival || r.value === null) return ''
  const [mine, theirs] = [fmt(r.value), fmt(r.bestRival.value)]
  return mine > theirs ? 'ahead' : mine < theirs ? 'behind' : 'even'
}
const line = (r: Row) =>
  `| \`${r.command}\` | ${r.metric} | ${fmt(r.value)}${r.ceiling ? ' (ceiling below 1)' : ''} | ${
    r.bestRival ? `${r.bestRival.tool} ${fmt(r.bestRival.value)}` : ''
  } | ${against(r)} | ${r.eval ? evalLink(r.eval) : ''} | ${r.set ?? ''} |`

export const markdown = (rows: readonly Row[]) =>
  [
    '| Command | Metric | Value | Best rival | Webular vs best rival | Measured by | Set |',
    '|---|---|---|---|---|---|---|',
  ]
    .concat(rows.map(line))
    .join('\n')

const BLOCK = /<!-- scoreboard:start -->\n[\s\S]*?<!-- scoreboard:end -->/

// The current and regenerated text of bench/scoreboard.json and docs/scoreboard.md.
export const render = (root: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const name = pickRun(yield* fs.readDirectory(`${root}bench/results/`)) ?? 'missing.json'
    const raw = yield* fs.readFileString(`${root}bench/results/${name}`)
    const run = yield* Schema.decodeUnknownEffect(PeerRun)(raw)
    const rows = buildRows(run.records, `bench/results/${name}`)
    const jsonPath = `${root}bench/scoreboard.json`
    const json = (yield* fs.exists(jsonPath)) ? yield* fs.readFileString(jsonPath) : ''
    const doc = yield* fs.readFileString(`${root}docs/scoreboard.md`)
    const block = `<!-- scoreboard:start -->\n${markdown(rows)}\n<!-- scoreboard:end -->`
    return {
      rows,
      files: [
        {
          path: 'bench/scoreboard.json',
          current: json,
          next: `${JSON.stringify(rows, null, 2)}\n`,
        },
        { path: 'docs/scoreboard.md', current: doc, next: doc.replace(BLOCK, block) },
      ],
    }
  })

if (import.meta.main) {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const main = Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const { files } = yield* render(root)
    for (const f of files) {
      if (f.next !== f.current) yield* fs.writeFileString(`${root}${f.path}`, f.next)
      const state = f.next === f.current ? 'current' : 'rewritten'
      yield* Console.log(`bench:scoreboard ${f.path}: ${state}`)
    }
  })
  BunRuntime.runMain(main.pipe(Effect.provide(BunServices.layer)))
}
