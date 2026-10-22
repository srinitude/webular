// Peer benchmark model: tasks, provider contract, and the open metric registry.
// Every number a run produces is a named metric with a dimension and a
// direction, so a new dimension (from benchmark-plan.json or here) is one new
// registry entry, never new plumbing.
import { Data, type Effect, Schema } from 'effect'

export const Job = Schema.Literals([
  'search',
  'scrape',
  'crawl',
  'map',
  'extract',
  'answer',
  'research',
  'summarize',
  'media',
  'parse',
  'batch',
  'act',
  'monitor',
])
export type Job = typeof Job.Type

// A check is data, so plan files can add tasks and metrics without code.
export const Check = Schema.Struct({
  kind: Schema.Literals(['contains', 'excludes', 'regex', 'urlMatches']),
  values: Schema.Array(Schema.String),
})
export type Check = typeof Check.Type

export const Task = Schema.Struct({
  id: Schema.String,
  job: Job,
  suite: Schema.String,
  // The run swaps `{fixture}` in url for the local fixture origin.
  input: Schema.Struct({
    query: Schema.optionalKey(Schema.String),
    url: Schema.optionalKey(Schema.String),
  }),
  // quality passes when every check passes; this is the "correct" bit.
  checks: Schema.Array(Check),
  // Answer aliases used to judge citation support.
  answers: Schema.optionalKey(Schema.Array(Schema.String)),
  localOnly: Schema.optionalKey(Schema.Boolean),
})
export type Task = typeof Task.Type

// A plan metric scores a record with one check over its output text.
export const MetricDef = Schema.Struct({
  name: Schema.String,
  dimension: Schema.String,
  better: Schema.Literals(['higher', 'lower']),
  unit: Schema.String,
  check: Schema.optionalKey(Check),
})
export type MetricDef = typeof MetricDef.Type

export const Plan = Schema.Struct({
  tasks: Schema.optionalKey(Schema.Array(Task)),
  metrics: Schema.optionalKey(Schema.Array(MetricDef)),
})
export type Plan = typeof Plan.Type

interface Citation {
  url: string
  text: string
}

export interface Output {
  text: string
  urls: string[]
  citations: Citation[]
  costUsd: number
  // Request bytes sent to a third party other than the page being read.
  sentBytes: number
}

export const RecordedOutput = Schema.Struct({
  text: Schema.String,
  urls: Schema.Array(Schema.String),
  citations: Schema.Array(Schema.Struct({ url: Schema.String, text: Schema.String })),
  costUsd: Schema.Number,
  sentBytes: Schema.Number,
  latencyMs: Schema.Number,
  attempts: Schema.Number,
})
export type RecordedOutput = typeof RecordedOutput.Type

export class BenchError extends Data.TaggedError('BenchError')<{ message: string }> {}

export interface TaskInput {
  query?: string
  url?: string
}

export interface Provider {
  id: string
  local: boolean
  keyNames: readonly string[]
  // Set when the provider cannot run (missing key): reported, never faked.
  skip?: string
  jobs: Partial<Record<Job, (input: TaskInput) => Effect.Effect<Output, BenchError>>>
}

// One row per (provider, task, run).
export interface RunRecord {
  provider: string
  task: string
  job: Job
  run: number
  status: 'ok' | 'error' | 'skipped' | 'unsupported' | 'unrecorded'
  note?: string
  outputHash?: string
  metrics: Record<string, number>
}

export const builtinMetrics: readonly MetricDef[] = [
  { name: 'accuracy', dimension: 'quality', better: 'higher', unit: 'share' },
  { name: 'answerAccuracy', dimension: 'quality', better: 'higher', unit: 'share' },
  { name: 'citationPrecision', dimension: 'quality', better: 'higher', unit: 'share' },
  { name: 'latencyP50Ms', dimension: 'speed', better: 'lower', unit: 'ms' },
  { name: 'latencyP95Ms', dimension: 'speed', better: 'lower', unit: 'ms' },
  { name: 'latencyP99Ms', dimension: 'speed', better: 'lower', unit: 'ms' },
  { name: 'coldStartMs', dimension: 'speed', better: 'lower', unit: 'ms' },
  { name: 'costPerCallUsd', dimension: 'cost', better: 'lower', unit: 'USD' },
  { name: 'costPerCorrectUsd', dimension: 'cost', better: 'lower', unit: 'USD' },
  { name: 'costPer1kTokensUsd', dimension: 'cost', better: 'lower', unit: 'USD' },
  { name: 'tokensPerTask', dimension: 'tokens', better: 'lower', unit: 'tokens' },
  { name: 'tokensPerCorrect', dimension: 'tokens', better: 'lower', unit: 'tokens' },
  { name: 'successRate', dimension: 'reliability', better: 'higher', unit: 'share' },
  { name: 'retriesPerCall', dimension: 'reliability', better: 'lower', unit: 'retries' },
  { name: 'determinism', dimension: 'reliability', better: 'higher', unit: 'share' },
  { name: 'runsOffline', dimension: 'control', better: 'higher', unit: 'bool' },
  { name: 'keysNeeded', dimension: 'control', better: 'lower', unit: 'keys' },
  { name: 'bytesSentOffMachine', dimension: 'control', better: 'lower', unit: 'bytes/task' },
]
