// The scenario file's schema, its loader, and the fixture and environment
// every baseline and model run shares.
import { Effect, FileSystem, Schema } from 'effect'
import type { Routes } from '../_support/fixture.ts'
import { ROOT } from '../_support/root.ts'
import { defaultRoutes } from '../_support/routes.ts'
import { e2eRoutes } from '../e2e/routes.ts'

export const Eval = Schema.Struct({
  kind: Schema.Literal('code'),
  answerContains: Schema.optional(Schema.Array(Schema.String)),
  answerMatches: Schema.optional(Schema.String),
})
export type Eval = typeof Eval.Type

const Step = Schema.Union([Schema.Array(Schema.String), Schema.Struct({ file: Schema.String })])
const Baseline = Schema.Struct({ pass: Schema.Boolean, problems: Schema.Array(Schema.String) })
export type Baseline = typeof Baseline.Type

export const Scenario = Schema.Struct({
  id: Schema.String,
  intent: Schema.String,
  outcome: Schema.String,
  eval: Eval,
  tool: Schema.String,
  // false grades the reply alone: the model may reach the outcome with another tool.
  requireTool: Schema.optional(Schema.Boolean),
  // Tools the run must not call: a call to one fails the scenario.
  avoidTools: Schema.optional(Schema.Array(Schema.String)),
  prompt: Schema.String,
  reference: Schema.Array(Step),
  surfaces: Schema.optional(Schema.Array(Schema.String)),
  maxTurns: Schema.optional(Schema.Number),
  timeoutSec: Schema.optional(Schema.Number),
  baseline: Schema.optional(Baseline),
  contractGaps: Schema.optional(Schema.Array(Schema.String)),
})
export type Scenario = typeof Scenario.Type

export const ScenarioFile = Schema.Struct({
  defaults: Schema.Struct({ maxTurns: Schema.Number, timeoutSec: Schema.Number }),
  models: Schema.Array(Schema.String),
  surfaces: Schema.Array(Schema.Literals(['cli', 'mcp', 'plugin'])),
  smoke: Schema.String,
  evalRules: Schema.String,
  routes: Schema.Record(Schema.String, Schema.Array(Schema.String)),
  scenarios: Schema.Array(Scenario),
})
export type ScenarioFile = typeof ScenarioFile.Type
export type Surface = ScenarioFile['surfaces'][number]

export const SCENARIO_PATH = `${ROOT}tests/models/scenarios.json`

export const loadScenarios = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const text = yield* fs.readFileString(SCENARIO_PATH)
  return yield* Schema.decodeUnknownEffect(Schema.fromJsonString(ScenarioFile))(text)
})

// Each scenario route serves its bodies in order, then repeats the last one,
// so a monitor sees one real change. Counters live per fixture.
const sequence = (bodies: readonly string[]) => {
  const hits = { n: 0 }
  return () => {
    const body = bodies[Math.min(hits.n++, bodies.length - 1)] ?? ''
    return new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' } })
  }
}

export const fixtureRoutes =
  (file: ScenarioFile) =>
  (origin: string): Routes => ({
    ...defaultRoutes(origin),
    ...e2eRoutes(origin),
    ...Object.fromEntries(
      Object.entries(file.routes).map(([path, bodies]) => [path, sequence(bodies)]),
    ),
  })

export const webularEnv = (origin: string, tmp: string): Record<string, string> => ({
  WEBULAR_SOURCE_ORIGIN: origin,
  WEBULAR_INVOKE_DIR: tmp,
  WEBULAR_DB: `${tmp}/webular.db`,
  WEBULAR_NO_CACHE: '1',
})
