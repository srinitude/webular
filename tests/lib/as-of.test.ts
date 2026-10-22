// Date grounding: WEBULAR_AS_OF pins the run date; without it the clock gives one.
import { expect, test } from 'bun:test'
import { ConfigProvider, Effect } from 'effect'
import { asOfDate } from '../../src/lib/as-of.ts'
import { eff } from '../_support/run.ts'

const pinned = ConfigProvider.layer(ConfigProvider.fromUnknown({ WEBULAR_AS_OF: '2026-10-21' }))

test('WEBULAR_AS_OF pins the run date; without it the clock gives an ISO date', () =>
  eff(
    Effect.gen(function* () {
      expect(yield* Effect.provide(asOfDate, pinned)).toBe('2026-10-21')
      expect(yield* asOfDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }),
  )())
