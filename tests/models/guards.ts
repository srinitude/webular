// Guard rules 26 to 31 for the agent and grader tracks: each check reads a
// track record and returns its problems, so an empty list means the rule holds.
import { Schema } from 'effect'

const MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'] as const

const Arm = Schema.Struct({
  surface: Schema.String,
  provider: Schema.String,
  args: Schema.Array(Schema.String),
  description: Schema.optional(Schema.String),
})
const Row = Schema.Struct({
  model: Schema.String,
  surface: Schema.String,
  provider: Schema.String,
  task: Schema.String,
  run: Schema.Number,
  family: Schema.String,
  promptSha: Schema.String,
  maxTurns: Schema.Number,
  timeoutSec: Schema.Number,
  grader: Schema.String,
  toolCalls: Schema.Array(Schema.Struct({ name: Schema.String, input: Schema.Unknown })),
  turns: Schema.NullOr(Schema.Number),
  inputTokens: Schema.NullOr(Schema.Number),
  outputTokens: Schema.NullOr(Schema.Number),
  wallMs: Schema.NullOr(Schema.Number),
  pass: Schema.Boolean,
  costUsd: Schema.NullOr(Schema.Number),
})
const Rubric = Schema.Struct({
  id: Schema.String,
  headlineJudge: Schema.String,
  cohen: Schema.Record(Schema.String, Schema.Number),
  fleiss: Schema.Number,
  claudeGraders: Schema.Array(
    Schema.Struct({ model: Schema.String, setsHeadline: Schema.Boolean }),
  ),
})
const Audit = Schema.Struct({
  provider: Schema.String,
  family: Schema.String,
  rows: Schema.Number,
  regraded: Schema.Number,
  agreement: Schema.NullOr(Schema.Number),
})
export const TrackRecord = Schema.Struct({
  arms: Schema.Array(Arm),
  rows: Schema.Array(Row),
  rubrics: Schema.Array(Rubric),
  audit: Schema.Array(Audit),
})
export type TrackRecord = typeof TrackRecord.Type
export type TrackRow = typeof Row.Type

export const armKey = (a: { surface: string; provider: string }) => `${a.surface}/${a.provider}`
const flag = (args: readonly string[], name: string) =>
  (args[args.indexOf(name) + 1] ?? '').split(',').filter(Boolean)

// 26: every arm ran with all three models.
export const threeModelsRan = (t: TrackRecord) =>
  t.arms.flatMap((a) =>
    MODELS.filter((m) => !t.rows.some((r) => r.model === m && armKey(r) === armKey(a))).map(
      (m) => `${armKey(a)} has no ${m} run`,
    ),
  )

// 27: each arm allows only its own tool, with WebSearch and WebFetch off.
export const oneWebToolPerArm = (t: TrackRecord, own: (a: typeof Arm.Type) => readonly string[]) =>
  t.arms.flatMap((a) => {
    const off = flag(a.args, '--disallowedTools')
    const allowed = flag(a.args, '--allowedTools')
    return [
      ...['WebSearch', 'WebFetch']
        .filter((x) => !off.includes(x))
        .map((x) => `${armKey(a)} leaves ${x} on`),
      ...allowed.filter((x) => !own(a).includes(x)).map((x) => `${armKey(a)} allows ${x}`),
    ]
  })

// 28: task text, turn budget, timeout, and grader match across arms; wrapper
// descriptions differ in length by at most 10%.
export const sameArmConditions = (t: TrackRecord) => {
  const seen = new Map<string, string>()
  const drift = t.rows.flatMap((r) => {
    const sig = [r.promptSha, r.maxTurns, r.timeoutSec, r.grader].join('|')
    const first = seen.get(r.task) ?? sig
    seen.set(r.task, first)
    return first === sig ? [] : [`${r.task} differs on ${armKey(r)} ${r.model}`]
  })
  const lengths = t.arms.flatMap((a) => (a.description ? [a.description.length] : []))
  const spread = lengths.length > 1 && Math.max(...lengths) > Math.min(...lengths) * 1.1
  return [...new Set(drift), ...(spread ? ['wrapper descriptions differ by more than 10%'] : [])]
}

// 29: every run records tool calls, turns, tokens, wall time, pass, and cost.
export const runRecordsComplete = (t: TrackRecord) =>
  t.rows.flatMap((r) => {
    const missing = (['turns', 'inputTokens', 'outputTokens', 'wallMs', 'costUsd'] as const).filter(
      (k) => r[k] === null,
    )
    return missing.length
      ? [`${armKey(r)} ${r.model} ${r.task}#${r.run} lacks ${missing.join(', ')}`]
      : []
  })

// 30: every rubric has Cohen's kappa per Claude model and Fleiss' kappa across
// them, and no Claude grader sets a headline score.
export const graderCrossCheck = (t: TrackRecord) =>
  t.rubrics.flatMap((g) => [
    ...MODELS.filter((m) => !Number.isFinite(g.cohen[m])).map(
      (m) => `${g.id} lacks Cohen's kappa for ${m}`,
    ),
    ...(Number.isFinite(g.fleiss) ? [] : [`${g.id} lacks Fleiss' kappa`]),
    ...(g.headlineJudge.startsWith('claude') ? [`${g.id} headline judge is a Claude model`] : []),
    ...g.claudeGraders
      .filter((c) => c.setsHeadline)
      .map((c) => `${g.id}: ${c.model} sets a headline`),
  ])

// 31: at least 5% of rows per provider and family were re-graded by people.
export const humanAudit = (t: TrackRecord) => {
  const cells = new Set(t.rows.map((r) => `${r.provider}/${r.family}`))
  return [...cells].flatMap((cell) => {
    const a = t.audit.find((x) => `${x.provider}/${x.family}` === cell)
    if (!a || a.agreement === null) return [`${cell} has no human audit`]
    return a.regraded < Math.ceil(a.rows * 0.05)
      ? [`${cell} audited ${a.regraded} of ${a.rows}`]
      : []
  })
}
