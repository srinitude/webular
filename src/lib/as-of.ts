// Run date an answer is grounded on: Effect's Clock, read once per run,
// or WEBULAR_AS_OF (YYYY-MM-DD) for replays and benches.
import { Clock, Config, Effect } from 'effect'

const pinnedAsOf = Config.String('WEBULAR_AS_OF').pipe(
  Config.withDefault(''),
  Effect.orDie,
  Effect.map((pinned) => (/^\d{4}-\d{2}-\d{2}$/.test(pinned) ? pinned : undefined)),
)

export const asOfDate = Effect.gen(function* () {
  const pinned = yield* pinnedAsOf
  if (pinned) return pinned
  return new Date(yield* Clock.currentTimeMillis).toISOString().slice(0, 10)
})

// The pinned date as a Wayback YYYYMMDD stamp; undefined when WEBULAR_AS_OF is unset.
export const asOfStamp = Effect.map(pinnedAsOf, (pinned) => pinned?.replaceAll('-', ''))
