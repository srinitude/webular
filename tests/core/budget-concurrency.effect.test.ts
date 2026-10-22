// WEBULAR_CONCURRENCY contract: a value that is not a positive integer stops
// the budget with a message naming the variable and the bad value, instead of
// being dropped in favor of the host-sized default.
// Each case builds a fresh HostBudget from its own env record: Effect caches
// its default ConfigProvider (a process.env copy) on first use, and eff's
// testLayer has already built the shared HostBudget.
import { expect, test } from 'bun:test'
import { ConfigProvider, Effect, Layer } from 'effect'
import { HostBudget, hostConcurrency } from '../../src/core/budget.ts'
import { eff, failMsg } from '../_support/run.ts'

const withConcurrency = (value: string) =>
  Effect.provide(
    Layer.fresh(HostBudget.layer).pipe(
      Layer.provide(
        ConfigProvider.layer(ConfigProvider.fromEnvRecord({ WEBULAR_CONCURRENCY: value })),
      ),
    ),
  )

for (const bad of ['abc', '0', '-3', '2.5']) {
  test(
    `WEBULAR_CONCURRENCY=${bad} fails with a clear message`,
    eff(
      Effect.gen(function* () {
        const message = yield* failMsg(hostConcurrency.pipe(withConcurrency(bad)))
        expect(message).toBe(`WEBULAR_CONCURRENCY must be a positive integer, got "${bad}"`)
      }),
    ),
  )
}

test(
  'WEBULAR_CONCURRENCY=3 sets the fan-out',
  eff(
    Effect.gen(function* () {
      expect(yield* hostConcurrency.pipe(withConcurrency('3'))).toBe(3)
    }),
  ),
)
