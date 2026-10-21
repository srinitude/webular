// A Jev decision may use at most half of the caller's fetch timeout. After that the
// decision is interrupted and its deterministic baseline answers, so Jev can never
// eat the time the fetch itself needs.
import { Duration, Effect, Option } from 'effect'
import { Jev } from './client.ts'

export const withinJevBudget = <A, E, R>(
  timeoutMs: number,
  effect: Effect.Effect<A, E, R>,
  fallback: () => A,
) =>
  Effect.timeoutOrElse(effect, {
    duration: Duration.millis(Math.max(0, timeoutMs / 2)),
    orElse: () => Effect.sync(fallback),
  })

// Runs a decision with the Jev service the caller (or a test) provided, else the
// live client. ponytail: Jev.live builds per call; share jevRuntime if fetches get hot.
export const withJev = <A, E>(effect: Effect.Effect<A, E, Jev>) =>
  Effect.flatMap(Effect.serviceOption(Jev), (jev) =>
    Option.isSome(jev)
      ? Effect.provideService(effect, Jev, jev.value)
      : Effect.provide(effect, Jev.live),
  )
