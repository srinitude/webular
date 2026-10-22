// Shared benchmark types (bench/spec/benchmark-spec.md). Every bench module
// imports its shapes from here; this file is the one interface the run,
// grading, statistics, report, and cost modules agree on.
import { Schema } from 'effect'

export const Family = Schema.Literals([
  'search.known-item',
  'search.fresh',
  'search.reasoning',
  'search.long-tail',
  'search.multilingual',
  'scrape.page',
  'batch.urls',
  'crawl.map',
  'answer.short',
  'answer.citation',
  'answer.false-premise',
  'answer.no-answer',
  'research.multihop',
  'research.wide',
  'research.report',
  'feed.items',
])
export type Family = typeof Family.Type

export const Split = Schema.Literals(['dev', 'sealed'])

// Diversity axes used by the quota guard and the slices part of the report.
const Tags = Schema.Struct({
  domain: Schema.String,
  language: Schema.String,
  fresh: Schema.Boolean,
  longTail: Schema.Boolean,
  navigational: Schema.Boolean,
  pageType: Schema.optional(Schema.String),
  premise: Schema.Literals(['true', 'false', 'none']),
})

// Deterministic checks run before any judge (spec-grading-and-stats.md).
export const Check = Schema.Union([
  Schema.Struct({ kind: Schema.Literal('contains'), value: Schema.String }),
  Schema.Struct({ kind: Schema.Literal('excludes'), value: Schema.String }),
  Schema.Struct({ kind: Schema.Literal('regex'), value: Schema.String }),
  Schema.Struct({ kind: Schema.Literal('urlMatches'), value: Schema.String }),
  Schema.Struct({
    kind: Schema.Literal('numeric'),
    value: Schema.Number,
    tolerance: Schema.Number,
  }),
])
export type Check = typeof Check.Type

export const Task = Schema.Struct({
  id: Schema.String,
  family: Family,
  split: Split,
  input: Schema.String,
  source: Schema.String,
  asOf: Schema.String,
  buildDate: Schema.String,
  author: Schema.String,
  questionType: Schema.String,
  aliases: Schema.Array(Schema.String),
  tags: Tags,
  checks: Schema.Array(Check),
  rubric: Schema.optional(Schema.String),
  // Gold for a page the site's robots.txt disallows (guard test 16).
  expect: Schema.optional(
    Schema.Struct({ status: Schema.Literal('blocked'), reason: Schema.Literal('robots') }),
  ),
})
export type Task = typeof Task.Type

// One frozen, versioned task file. The loader refuses frozen: false.
export const TaskFile = Schema.Struct({
  version: Schema.String,
  frozen: Schema.Boolean,
  canary: Schema.String,
  tasks: Schema.Array(Task),
})
export type TaskFile = typeof TaskFile.Type

// manifest.json: set version plus sha256 per frozen file path.
export const Manifest = Schema.Struct({
  version: Schema.String,
  files: Schema.Record(Schema.String, Schema.String),
})
export type Manifest = typeof Manifest.Type

// One generated line of bench/tasks/<split>/<name>.jsonl (scripts/bench/tasks).
// The line after the { canary } header; gold is per-family grader input.
export const SetTask = Schema.Struct({
  id: Schema.String,
  family: Schema.String,
  split: Schema.optional(Schema.Literals(['dev', 'test', 'private'])),
  input: Schema.Record(Schema.String, Schema.Unknown),
  gold: Schema.Record(Schema.String, Schema.Unknown),
  aliases: Schema.Array(Schema.String),
  source: Schema.Struct({ url: Schema.String, asOf: Schema.String, license: Schema.String }),
  author: Schema.String,
  buildDate: Schema.String,
  questionType: Schema.String,
  tags: Schema.StructWithRest(
    Schema.Struct({
      domain: Schema.String,
      language: Schema.String,
      fresh: Schema.Boolean,
      longTail: Schema.Boolean,
    }),
    [Schema.Record(Schema.String, Schema.Union([Schema.String, Schema.Boolean, Schema.Number]))],
  ),
  canary: Schema.String,
})
export type SetTask = typeof SetTask.Type

export const Status = Schema.Literals([
  'ok',
  'wrong',
  'empty',
  'error_4xx',
  'error_5xx',
  'timeout',
  'blocked',
  'rate_limited',
  'not_offered',
])
export type Status = typeof Status.Type

// Every outbound call a tool makes; webular's include Jev at api.typesafe.ai.
export const OutboundCall = Schema.Struct({
  host: Schema.String,
  kind: Schema.Literals(['jev', 'search', 'fetch', 'model']),
  bytes: Schema.Number,
  usd: Schema.Number,
  priceSource: Schema.String,
  priceDate: Schema.String,
})
export type OutboundCall = typeof OutboundCall.Type

// Recordings are keyed by commit, settings hash, and date (guard test 13).
export const RecordingKey = Schema.Struct({
  provider: Schema.String,
  taskId: Schema.String,
  run: Schema.Number,
  commit: Schema.String,
  settingsHash: Schema.String,
  date: Schema.String,
})
export type RecordingKey = typeof RecordingKey.Type

export const Row = Schema.Struct({
  key: RecordingKey,
  family: Family,
  round: Schema.String,
  settings: Schema.Literals(['default', 'best']),
  phase: Schema.Literals(['cold', 'warm']),
  query: Schema.String,
  requestBody: Schema.String,
  output: Schema.String,
  status: Status,
  latencyMs: Schema.Number,
  cached: Schema.Boolean,
  loadAvg: Schema.Number,
  cpuMs: Schema.Number,
  calls: Schema.Array(OutboundCall),
  // Every HTTP request the tool made, when recorded (guard test 16).
  requests: Schema.optional(
    Schema.Array(Schema.Struct({ method: Schema.String, url: Schema.String })),
  ),
})
export type Row = typeof Row.Type

// Equal limits for every provider (audit finding 8, guard test 11).
export const RunConfig = Schema.Struct({
  seed: Schema.Number,
  rounds: Schema.Number,
  resultCount: Schema.Number,
  timeoutMs: Schema.Number,
  retries: Schema.Number,
  budgetUsd: Schema.Number,
  providers: Schema.Array(Schema.String),
})
export type RunConfig = typeof RunConfig.Type

export type JudgeLabel = 'correct' | 'incorrect' | 'not_attempted'
export type Verdict = 'win' | 'loss' | 'tie' | 'not enough tasks' | 'not offered'

// One paired comparison of webular against a peer on one family.
export interface Comparison {
  readonly family: Family
  readonly peer: string
  readonly n: number
  readonly diff: number
  readonly ci: readonly [number, number]
  readonly test: 'exact McNemar' | 'paired permutation'
  readonly p: number
  readonly pHolm: number
  readonly verdict: Verdict
}
