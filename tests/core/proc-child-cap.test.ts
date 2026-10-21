// Child-process cap: parallel runProc calls hold a shared permit for each
// child's lifetime, so no more than the cap run at once.
import { expect, test } from 'bun:test'
import { Clock, Effect, Semaphore } from 'effect'
import { ProcPermits, runProc } from '../../src/core/proc.ts'
import { eff } from '../_support/run.ts'

const CAP = 2
const CALLS = 6
const SLEEP_MS = 300

test(
  'six parallel children under a cap of two run in three waves',
  eff(
    Effect.gen(function* () {
      const start = yield* Clock.currentTimeMillis
      const child = runProc(['bun', '-e', `await Bun.sleep(${SLEEP_MS})`], { timeoutMs: 10_000 })
      const codes = yield* Effect.all(
        Array.from({ length: CALLS }, () => child),
        {
          concurrency: CALLS,
        },
      ).pipe(Effect.provideService(ProcPermits, Semaphore.makeUnsafe(CAP)))
      expect(codes.map((r) => r.code)).toEqual(Array(CALLS).fill(0))
      const waves = CALLS / CAP
      expect((yield* Clock.currentTimeMillis) - start).toBeGreaterThanOrEqual(waves * SLEEP_MS)
    }),
  ),
  20_000,
)
