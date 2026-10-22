// Code scorers for date grounding and recency, run on real outputs (no mocks).
// Date grounding: an output carries an ISO asOf that equals the pinned run date.
// Recency: the top hit's date falls within RECENCY_WINDOW_DAYS before asOf,
// the 365-day half-life the source ranker uses (src/lib/sources/rank.ts).
import { expect, test } from 'bun:test'
import { ConfigProvider, Effect } from 'effect'
import { asOfDate } from '../../src/lib/as-of.ts'
import { eff } from '../_support/run.ts'

const RECENCY_WINDOW_DAYS = 365
const DAY_MS = 86_400_000

const dateGrounding = (out: { asOf?: string }, pinned: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(out.asOf ?? '') && out.asOf === pinned ? 1 : 0

const recency = (topHitDate: string | undefined, asOf: string) => {
  if (!topHitDate) return 0
  const age = (Date.parse(asOf) - Date.parse(topHitDate)) / DAY_MS
  return age >= 0 && age <= RECENCY_WINDOW_DAYS ? 1 : 0
}

test('date grounding scores the asOf stamp the run date gives', () =>
  eff(
    Effect.gen(function* () {
      const pinned = ConfigProvider.fromUnknown({ WEBULAR_AS_OF: '2026-10-21' })
      const asOf = yield* Effect.provide(asOfDate, ConfigProvider.layer(pinned))
      expect(dateGrounding({ asOf }, '2026-10-21')).toBe(1)
      expect(dateGrounding({}, '2026-10-21')).toBe(0)
      expect(dateGrounding({ asOf: '2025-10-21' }, '2026-10-21')).toBe(0)
    }),
  )())

test('recency scores a top hit dated inside the window before asOf', () => {
  expect(recency('2026-09-01', '2026-10-21')).toBe(1)
  expect(recency('2025-06-01', '2026-10-21')).toBe(0)
  expect(recency('2026-12-01', '2026-10-21')).toBe(0)
  expect(recency(undefined, '2026-10-21')).toBe(0)
})
