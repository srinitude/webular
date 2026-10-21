// Joins Jev calibration rows (WEBULAR_JEV_LOG) to bench cases, so a wrong-but-sure
// answer traces back to its task. The bench runs webular one task at a time and
// writes a `bench.case` marker row before each; every row after a marker belongs
// to that case until the next one. ponytail: order-based join, wrong if webular
// tasks ever run concurrently; then thread the case through the Jev client.
import { Clock, Config, Effect, type FileSystem, Option } from 'effect'

const CASE_DECISION = 'bench.case'

export const markCase = (fs: FileSystem.FileSystem, task: string, run: number) =>
  Effect.gen(function* () {
    const log = yield* Config.option(Config.String('WEBULAR_JEV_LOG'))
    if (Option.isNone(log)) return
    const at = new Date(yield* Clock.currentTimeMillis).toISOString()
    const row = { at, decision: CASE_DECISION, case: `${task}#${run}` }
    yield* fs
      .writeFileString(log.value, `${JSON.stringify(row)}\n`, { flag: 'a' })
      .pipe(Effect.ignore)
  })

interface Row {
  readonly decision?: string
  readonly case?: string
}

// Drops the markers and stamps each Jev row with the case it ran under.
export const joinCases = <R extends Row>(rows: readonly R[]) => {
  let current: string | undefined
  return rows.flatMap((r) => {
    if (r.decision !== CASE_DECISION) return [{ ...r, case: current }]
    current = r.case
    return []
  })
}
