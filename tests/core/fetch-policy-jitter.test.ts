// The retry pause is the fixed backoff with jitter (Schedule.jittered: 0.8x to 1.2x),
// run under TestClock so no real time passes.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { TestClock } from 'effect/testing'
import { RETRY_BACKOFF_MS, retryPause } from '../../src/core/fetch-policy.ts'

const BASE = RETRY_BACKOFF_MS[1]

const pauseDone = (advanceMs: number) =>
  Effect.gen(function* () {
    const fiber = yield* Effect.forkChild(retryPause(BASE))
    yield* TestClock.adjust(advanceMs)
    return fiber.pollUnsafe() !== undefined
  }).pipe(Effect.scoped, Effect.provide(TestClock.layer()))

test('retry pause never ends before 0.8x the backoff', () =>
  Effect.runPromise(Effect.map(pauseDone(BASE * 0.8 - 1), (done) => expect(done).toBe(false))))

test('retry pause always ends by 1.2x the backoff', () =>
  Effect.runPromise(Effect.map(pauseDone(BASE * 1.2 + 1), (done) => expect(done).toBe(true))))

test('retry pause is jittered, not fixed', () =>
  Effect.runPromise(
    Effect.map(
      Effect.forEach(Array.from({ length: 20 }), () => pauseDone(BASE), { concurrency: 4 }),
      (ends) => expect(new Set(ends).size).toBe(2),
    ),
  ))
