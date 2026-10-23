// A failing host stops eating retries: 50 GETs to a host that always answers
// 503 cost at most 50 x 1.2 + a small constant attempts, not about 150.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { HostRetries, RETRY_BUDGET } from '../../src/core/fetch-policy.ts'
import { httpGet } from '../../src/core/http.ts'
import { useFixture } from '../_support/fixture.ts'
import { eff } from '../_support/run.ts'

const fx = useFixture(() => ({ '/down': () => new Response('down', { status: 503 }) }))

test(
  'caps retries per host at the budget and breaker',
  eff(
    Effect.gen(function* () {
      const urls = Array.from({ length: 50 }, () => `${fx.origin}/down`)
      const statuses = yield* Effect.forEach(urls, (u) => Effect.map(httpGet(u), (r) => r.status), {
        concurrency: 1,
      })
      expect(statuses.every((s) => s === 503)).toBe(true)
      expect(fx.hits('/down')).toBeLessThanOrEqual(50 * 1.2 + RETRY_BUDGET.floor)
      expect(fx.hits('/down')).toBeGreaterThan(50) // the first request still retried
    }).pipe(Effect.provideService(HostRetries, new Map())),
  ),
  30_000,
)
