// Generated benchmark block text from one peer run: records give status counts and
// job scores, the text report gives the shared-task tables. docs.ts places them.
import type { RunRecord } from './model.ts'

export interface Run {
  name: string
  sha: string
  json: { runs: number; records: RunRecord[] } & Record<string, unknown>
  txt: string
}

type Score = { job: string; tool: string; tasks: number; score: number }

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const f3 = (x: number) => x.toFixed(3)
const tools = (rs: readonly RunRecord[]) => [...new Set(rs.map((r) => r.provider))]
const STATUSES = ['ok', 'error', 'unsupported', 'skipped', 'unrecorded'] as const

// Mean over tasks of each task's mean accuracy across its ok runs.
const scoreOf = (ok: readonly RunRecord[], job: string, tool: string): Score[] => {
  const rows = ok.filter((r) => r.job === job && r.provider === tool)
  const byTask = Map.groupBy(rows, (r) => r.task)
  const per = [...byTask.values()].map((g) => mean(g.map((r) => r.metrics['accuracy'] ?? 0)))
  return byTask.size ? [{ job, tool, tasks: byTask.size, score: mean(per) }] : []
}

const jobScores = (rs: readonly RunRecord[]): Score[] => {
  const ok = rs.filter((r) => r.status === 'ok')
  const jobs = [...new Set(ok.map((r) => r.job))].toSorted()
  const names = tools(ok).toSorted()
  return jobs.flatMap((job) => names.flatMap((tool) => scoreOf(ok, job, tool)))
}

type Rows = Map<string, string[]>

// Rows of one `== title ==` table in the harness text report, keyed by metric.
const txtTable = (txt: string, title: string): Rows => {
  const lines = txt.split('\n')
  const at = lines.findIndex((l) => l.startsWith(`== ${title}`))
  const body = at < 0 ? [] : lines.slice(at + 2)
  const end = body.findIndex((l) => !l.trim() || l.startsWith('=='))
  const rows: Rows = new Map()
  for (const l of end < 0 ? body : body.slice(0, end)) {
    const [k, , ...v] = l.trim().split(/\s+/)
    if (k) rows.set(k, v)
  }
  return rows
}

const cell = (rows: Rows, k: string, i: number) => rows.get(k)?.[i] ?? 'n/a'

const SHARED = [
  ['accuracy', 'accuracy'],
  ['citationPrecision', 'citation precision'],
  ['latencyP50Ms', 'latency p50 (ms)'],
  ['latencyP95Ms', 'latency p95 (ms)'],
  ['successRate', 'success rate'],
  ['determinism', 'determinism'],
  ['costPerCallUsd', 'cost per call (USD)'],
  ['keysNeeded', 'keys needed'],
] as const

interface Ctx {
  run: Run
  json: string
  txt: string
  src: string
  scores: Score[]
  web: (job: string) => Score | undefined
  taskCounts: [string, number][]
  all: Rows
  shared: { peer: string; n: string; rows: Rows }[]
}

const context = (run: Run, prefix: string): Ctx => {
  const json = `${prefix}${run.name}`
  const scores = jobScores(run.json.records)
  const byJob = Map.groupBy(new Map(run.json.records.map((r) => [r.task, r.job])), ([, j]) => j)
  const heads = [...run.txt.matchAll(/^== webular vs (\S+) on (\d+) shared tasks ==$/gm)]
  return {
    run,
    json,
    txt: json.replace(/\.json$/, '.txt'),
    src: `Source: [${run.name}](${json})`,
    scores,
    web: (job) => scores.find((s) => s.job === job && s.tool === 'webular'),
    taskCounts: [...byJob].map(([j, g]) => [j, g.length]),
    all: txtTable(run.txt, 'webular, every task'),
    shared: heads.map(([, peer = '', n = '']) => ({
      peer,
      n,
      rows: txtTable(run.txt, `webular vs ${peer} on`),
    })),
  }
}

const counts = (c: Ctx) => c.taskCounts.map(([j, n]) => `${n} ${j}`).join(', ')

const runBlock = (c: Ctx) =>
  [
    `All numbers come from one committed peer run, with ${c.run.json.runs} runs per task (sha256 \`${c.run.sha}\`):`,
    '',
    `- [${c.run.name}](${c.json}): one row per tool, task, and run, with its status and accuracy.`,
    `- [${c.run.name.replace(/\.json$/, '.txt')}](${c.txt}): the harness's text report for the same run.`,
  ].join('\n')

const readmeBlock = (c: Ctx) => {
  const w = c.web('search')
  const peers = c.scores.filter((s) => s.job === 'search' && s.tool !== 'webular')
  const ps = peers.map((s) => `${s.tool} scored ${f3(s.score)} on ${s.tasks}`).join(' and ')
  return `- **Measured, not claimed.** On the committed peer run ([${c.run.name}](${c.json})), webular search scored ${f3(w?.score ?? 0)} on ${w?.tasks ?? 0} search tasks, while ${ps}. Read [the benchmark results](docs/benchmarks.md) for every score and the method behind it.`
}

const jobLine = (c: Ctx, job: string) => {
  const w = c.web(job)
  const head = w ? `webular scores ${f3(w.score)} on ${w.tasks} tasks` : 'webular has no score'
  const peers = c.scores.filter((s) => s.job === job && s.tool !== 'webular')
  const ps = peers.map((s) => `${s.tool} scores ${f3(s.score)} on ${s.tasks} tasks`)
  return `- **${job}:** ${[head, ...ps].join('; ')}. ${c.src}.`
}

const shortBlock = (c: Ctx) =>
  [
    ...[...new Set(c.scores.map((s) => s.job))].map((job) => jobLine(c, job)),
    `- **Where webular leads:** it runs offline, needs ${cell(c.all, 'keysNeeded', 0)} keys, and costs ${cell(c.all, 'costPerCallUsd', 0)} USD per call. Source: [the text report](${c.txt}).`,
  ].join('\n')

const statusBlock = (c: Ctx) => {
  const rs = c.run.json.records
  const n = (t: string, s: string) => rs.filter((r) => r.provider === t && r.status === s).length
  return [
    `| tool | ${STATUSES.join(' | ')} |`,
    `| --- |${' --- |'.repeat(STATUSES.length)}`,
    ...tools(rs).map((t) => `| ${t} | ${STATUSES.map((s) => n(t, s)).join(' | ')} |`),
  ].join('\n')
}

const jobsBlock = (c: Ctx) =>
  [
    '| job | tool | tasks | mean accuracy |',
    '| --- | --- | --- | --- |',
    ...c.scores.map((s) => `| ${s.job} | ${s.tool} | ${s.tasks} | ${f3(s.score)} |`),
  ].join('\n')

const sharedBlock = (c: Ctx) => {
  const a = (k: string) => cell(c.all, k, 0)
  const pair = (rows: Rows, k: string) => ` ${cell(rows, k, 0)} | ${cell(rows, k, 1)} |`
  return [
    `| metric |${c.shared.map((s) => ` webular | ${s.peer} (${s.n} shared tasks) |`).join('')}`,
    `| --- |${' --- | --- |'.repeat(c.shared.length)}`,
    ...SHARED.map(([k, label]) => `| ${label} |${c.shared.map((s) => pair(s.rows, k)).join('')}`),
    '',
    `Across all of its own tasks, webular has an accuracy of ${a('accuracy')}, a success rate of ${a('successRate')}, a p50 latency of ${a('latencyP50Ms')} ms, and a p95 latency of ${a('latencyP95Ms')} ms.`,
    `Source: [the text report](${c.txt}).`,
  ].join('\n')
}

const pairOf = (rows: Rows, k: string) => [Number(cell(rows, k, 0)), Number(cell(rows, k, 1))]

const notesBlock = (c: Ctx) => {
  const acc = c.shared.map(({ peer, n, rows }) => {
    const [w = 0, p = 0] = pairOf(rows, 'accuracy')
    const word = w < p ? 'trails' : w > p ? 'leads' : 'ties'
    return `- On the ${n} tasks it shares with ${peer}, webular ${word} on accuracy, ${w} against ${p}.`
  })
  const p50 = c.shared.map(({ peer, rows }) => {
    const [w = 0, p = 0] = pairOf(rows, 'latencyP50Ms')
    return `${w <= p ? 'faster' : 'slower'} than ${peer} at p50 (${w} ms against ${p} ms)`
  })
  return [
    ...acc,
    `- Webular is ${p50.join(', and ')}.`,
    `- The task counts are very small: ${counts(c)} tasks. Treat every gap as a sign, not a proof.`,
  ].join('\n')
}

const fieldsBlock = (c: Ctx) => {
  const keys = Object.keys(c.run.json).map((k) => `\`${k}\``)
  const seed = 'seed' in c.run.json ? '' : ' It saves no seed or task order.'
  return `The results file has these top-level fields: ${keys.join(', ')}.${seed}`
}

export const blocks = (run: Run, prefix: string): Record<string, string> => {
  const c = context(run, prefix)
  return {
    run: runBlock(c),
    readme: readmeBlock(c),
    short: shortBlock(c),
    ran: `The run has ${c.taskCounts.reduce((a, [, n]) => a + n, 0)} tasks: ${counts(c)}.\n${c.src}.`,
    status: statusBlock(c),
    jobs: jobsBlock(c),
    shared: sharedBlock(c),
    notes: notesBlock(c),
    fields: fieldsBlock(c),
  }
}
