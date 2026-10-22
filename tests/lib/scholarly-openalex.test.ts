// OpenAlex over a real local Bun.serve fixture: a 429 yields no hits (not an
// error) and is not retried again by the next search; an API key reaches the
// host as api_key. No mocks.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { OpenAlexLimit, openalex } from '../../src/lib/scholarly.ts'
import { against, body, json, run } from './sources/support.ts'

const gap = { WEBULAR_SOURCE_GAP_MS: '0' }

const searchTwice = Effect.gen(function* () {
  const seen = { calls: 0 }
  const route = () => {
    seen.calls++
    return json('{}', 429)
  }
  const search = openalex('crispr', 2)
  const first = yield* against({ '/works': route }, search, gap)
  const callsAfterFirst = seen.calls
  const second = yield* against({ '/works': route }, search, gap)
  return { first, second, callsAfterFirst, calls: seen.calls }
})

const sentKey = Effect.gen(function* () {
  const text = yield* body('openalex-works.json')
  const seen = { key: '' }
  const route = (_req: Request, url: URL) => {
    seen.key = url.searchParams.get('api_key') ?? ''
    return json(text)
  }
  const extra = { ...gap, OPENALEX_API_KEY: 'k-123' }
  yield* against({ '/works': route }, openalex('crispr', 2), extra)
  return seen.key
})

const fresh = <A, E, R>(eff: Effect.Effect<A, E, R>) =>
  Effect.provideService(eff, OpenAlexLimit, { until: 0 })

describe('openalex api key and rate limit', () => {
  test(
    'a 429 gives no hits and no retry storm',
    () =>
      run(
        fresh(searchTwice).pipe(
          Effect.tap((out) =>
            Effect.sync(() => {
              expect(out.first).toEqual([])
              expect(out.second).toEqual([])
              expect(out.calls).toBe(out.callsAfterFirst)
            }),
          ),
        ),
      ),
    15_000,
  )

  test(
    'OPENALEX_API_KEY is sent as api_key',
    () =>
      run(fresh(sentKey).pipe(Effect.tap((key) => Effect.sync(() => expect(key).toBe('k-123'))))),
    15_000,
  )
})
