// OpenAlex rate limits against a real local Bun.serve fixture: a 429 (with or
// without retry-after) blocks OpenAlex, so the next search fails at once with
// a 429 "skipped" reason and never reaches the host. No mocks.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { OpenAlexLimit, openalex } from '../../../src/lib/scholarly.ts'
import { against, body, json, run } from './support.ts'

const twice = (status: number, headers: Record<string, string>) =>
  Effect.gen(function* () {
    const text = yield* body('openalex-works.json')
    const seen = { calls: 0 }
    const route = () => {
      seen.calls++
      const res = json(text, status)
      for (const [k, v] of Object.entries(headers)) res.headers.set(k, v)
      return res
    }
    const search = openalex('crispr', 2).pipe(Effect.result)
    const first = yield* against({ '/works': route }, search)
    const callsAfterFirst = seen.calls
    const second = yield* against({ '/works': route }, search)
    return { first, second, callsAfterFirst, calls: seen.calls }
  }).pipe(Effect.provideService(OpenAlexLimit, { until: 0 }))

const skipsAfter = (headers: Record<string, string>) =>
  Effect.gen(function* () {
    const out = yield* twice(429, headers)
    for (const r of [out.first, out.second]) {
      expect(r._tag).toBe('Success')
      expect((r as { success: unknown }).success).toEqual([])
    }
    expect(out.calls).toBe(out.callsAfterFirst)
  })

const keepsAsking = Effect.gen(function* () {
  const out = yield* twice(200, {})
  expect(out.second._tag).toBe('Success')
  expect(out.calls).toBe(2)
})

describe('openalex rate limit', () => {
  test(
    '429 with retry-after skips OpenAlex',
    () => run(skipsAfter({ 'retry-after': '30' })),
    15_000,
  )
  test('bare 429 skips OpenAlex for a minute', () => run(skipsAfter({})), 15_000)
  test('a 200 keeps asking OpenAlex', () => run(keepsAsking), 15_000)
})
