// The plan file (BENCH_PLAN, default bench/benchmark-plan.json) adds tasks and
// metrics to the built-in set. A missing or unreadable plan adds none and says why.
import { Effect, Schema } from 'effect'
import { type MetricDef, Plan, type Task } from './model.ts'

export const loadPlan = (path: string) =>
  Effect.gen(function* () {
    const file = Bun.file(path)
    if (!(yield* Effect.promise(() => file.exists())))
      return { tasks: [], metrics: [], note: `no plan at ${path}` }
    const raw = yield* Effect.tryPromise(() => file.json())
    const plan = yield* Schema.decodeUnknownEffect(Plan)(raw)
    return {
      tasks: plan.tasks ?? [],
      metrics: plan.metrics ?? ([] as MetricDef[]),
      note: `plan ${path}`,
    }
  }).pipe(
    Effect.catch((e) =>
      Effect.succeed({
        tasks: [] as Task[],
        metrics: [] as MetricDef[],
        note: `plan unreadable: ${String(e)}`,
      }),
    ),
  )
