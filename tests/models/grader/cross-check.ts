// Grader cross-check: every rubric on the gold set, judged by all three Claude
// models one job at a time. Prints JSON: Cohen's kappa per model against gold,
// Fleiss' kappa across the three, the self-preference gap on Claude-written
// answers, and setsHeadline: false for every Claude grader (spec: the headline
// judge comes from a model family no scored tool uses).
//   bun tests/models/grader/cross-check.ts                       live run
//   bun tests/models/grader/cross-check.ts --offline <recorded>  recorded verdicts
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Console, Effect, FileSystem, Schema } from 'effect'
import { ROOT } from '../../_support/root.ts'
import { judge, MODELS, type Model, type Verdict } from './judge.ts'
import { cohen, fleiss } from './kappa.ts'

const V = Schema.Literals(['pass', 'fail'])
const Gold = Schema.fromJsonString(
  Schema.Struct({
    rubrics: Schema.Record(Schema.String, Schema.String),
    items: Schema.Array(
      Schema.Struct({
        id: Schema.String,
        rubric: Schema.String,
        task: Schema.String,
        expected: Schema.String,
        answer: Schema.String,
        claudeWritten: Schema.Boolean,
      }),
    ),
    gold: Schema.Record(Schema.String, V),
  }),
)
type GoldFile = typeof Gold.Type
const Recorded = Schema.fromJsonString(
  Schema.Struct({ verdicts: Schema.Record(Schema.String, Schema.Record(Schema.String, V)) }),
)
type Verdicts = Record<string, Record<string, Verdict>>

const GOLD_PATH = `${ROOT}tests/models/grader/fixtures/gold.json`

const passRate = (vs: readonly Verdict[]) => vs.filter((v) => v === 'pass').length / vs.length

const stats = (g: GoldFile, verdicts: Verdicts) => {
  const ids = g.items.map((i) => i.id)
  const gold = ids.map((id) => g.gold[id] as Verdict)
  const own = g.items.filter((i) => i.claudeWritten).map((i) => i.id)
  const graders = MODELS.map((model) => {
    const got = ids.map((id) => verdicts[model]?.[id] ?? 'missing')
    const ownGot = own.map((id) => verdicts[model]?.[id] as Verdict)
    return {
      model,
      cohenKappa: cohen(got, gold),
      selfPreferenceGap: passRate(ownGot) - passRate(own.map((id) => g.gold[id] as Verdict)),
      setsHeadline: false as const,
    }
  })
  const rows = ids.map((id) => MODELS.map((m) => verdicts[m]?.[id] ?? 'missing'))
  return {
    items: ids.length,
    claudeWrittenItems: own.length,
    graders,
    fleissKappa: fleiss(rows),
    ships: graders.every((r) => r.cohenKappa >= 0.8),
  }
}

// One job at a time per model: the three models run side by side, but no
// model ever has two judgments in flight.
const live = (g: GoldFile) =>
  Effect.forEach(
    MODELS,
    (model: Model) =>
      Effect.forEach(
        g.items,
        (i) =>
          judge(model, `${g.rubrics[i.rubric]}\nReference: ${i.expected}`, i.task, i.answer).pipe(
            Effect.map((r) => [i.id, r.verdict] as const),
          ),
        { concurrency: 1 },
      ).pipe(Effect.map((pairs) => [model, Object.fromEntries(pairs)] as const)),
    { concurrency: MODELS.length },
  ).pipe(Effect.map((rows): Verdicts => Object.fromEntries(rows)))

// recorded: a file of earlier verdicts, or undefined to call claude live.
export const crossCheck = (recorded: string | undefined) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const g = yield* Schema.decodeEffect(Gold)(yield* fs.readFileString(GOLD_PATH))
    const verdicts = recorded
      ? (yield* Schema.decodeEffect(Recorded)(yield* fs.readFileString(recorded))).verdicts
      : yield* live(g)
    return { ...stats(g, verdicts), verdicts }
  })

const at = process.argv.indexOf('--offline')
const main = crossCheck(at > 0 ? process.argv[at + 1] : undefined).pipe(
  Effect.flatMap((r) => Console.log(JSON.stringify(r, null, 2))),
  Effect.provide(BunServices.layer),
)

if (import.meta.main) BunRuntime.runMain(main)
