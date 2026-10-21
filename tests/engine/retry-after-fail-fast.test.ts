// A 429 whose Retry-After outlasts the caller's timeout fails at once instead
// of waiting out the capped retry (keyless OpenAlex sends a day-long value).
import { expect, test } from 'bun:test'
import { Clock, Effect } from 'effect'
import { fetchText } from '../../src/core/http.ts'
import { HttpStatusError } from '../../src/core/http-body.ts'
import { useFixture } from '../_support/fixture.ts'
import { eff } from '../_support/run.ts'

const fx = useFixture(() => ({
  '/day-long': () => new Response('slow', { status: 429, headers: { 'retry-after': '86400' } }),
}))

test(
  'Retry-After beyond the timeout returns the 429 without waiting',
  eff(
    Effect.gen(function* () {
      const started = yield* Clock.currentTimeMillis
      const err = yield* Effect.flip(fetchText(`${fx.origin}/day-long`, { timeoutMs: 2500 }))
      expect(err).toBeInstanceOf(HttpStatusError)
      expect((err as HttpStatusError).status).toBe(429)
      expect((yield* Clock.currentTimeMillis) - started).toBeLessThan(1000)
      expect(fx.hits('/day-long')).toBe(1)
    }),
  ),
)
