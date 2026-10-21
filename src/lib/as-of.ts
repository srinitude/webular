// Run date an answer is grounded on: Effect's Clock, read once per run,
// or WEBULAR_AS_OF (YYYY-MM-DD) for replays and benches.
import { Clock, Config, Effect } from 'effect'

export const asOfDate = Effect.gen(function* () {
  const pinned = yield* Config.String('WEBULAR_AS_OF').pipe(Config.withDefault(''), Effect.orDie)
  if (/^\d{4}-\d{2}-\d{2}$/.test(pinned)) return pinned
  return new Date(yield* Clock.currentTimeMillis).toISOString().slice(0, 10)
})
