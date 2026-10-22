// Bounded source fan-out (P5/B21/B22): entries keep INPUT order regardless of
// latency, failures surface as attempt-ordered errors, results are stable.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { fetchSources } from '../../src/lib/sources.ts'
import { useFixture } from '../_support/fixture.ts'
import { defaultRoutes } from '../_support/routes.ts'
import { eff } from '../_support/run.ts'

const fx = useFixture(defaultRoutes)

describe('fetchSources — index-ordered bounded fan-out', () => {
  test(
    'entries follow input order even when the first source is slowest',
    eff(
      Effect.gen(function* () {
        const sources = [
          { title: 'Slow', url: `${fx.origin}/slow?ms=120` },
          { title: 'Gamma', url: `${fx.origin}/c` },
          { title: 'Alpha', url: `${fx.origin}/a` },
        ]
        const { entries, errors } = yield* fetchSources(
          sources,
          15_000,
          Number.POSITIVE_INFINITY,
          true,
        )
        expect(entries.map((e) => e.title)).toEqual(['Slow', 'Gamma', 'Alpha'])
        expect(entries.every((e) => e.text.length > 0)).toBe(true)
        expect(errors).toEqual([])
      }),
    ),
    15_000,
  )

  test(
    'failed sources land in errors, not entries',
    eff(
      Effect.gen(function* () {
        const sources = [
          { title: 'Gamma', url: `${fx.origin}/c` },
          { title: 'Broken', url: `${fx.origin}/status?code=404` },
          { title: 'Alpha', url: `${fx.origin}/a` },
        ]
        const { entries, errors } = yield* fetchSources(
          sources,
          15_000,
          Number.POSITIVE_INFINITY,
          true,
        )
        expect(entries.map((e) => e.title)).toEqual(['Gamma', 'Alpha'])
        expect(errors).toEqual([
          { url: `${fx.origin}/status?code=404`, reason: expect.stringContaining('404') },
        ])
      }),
    ),
    15_000,
  )

  test(
    'one page under several URL spellings is fetched and cited once',
    eff(
      Effect.gen(function* () {
        const before = fx.hits('/b')
        const sources = [
          { title: 'B', url: `${fx.origin}/b` },
          { title: 'B fragment', url: `${fx.origin}/b#top` },
          { title: 'B tracked', url: `${fx.origin}/b?utm_source=feed` },
          { title: 'A', url: `${fx.origin}/a` },
        ]
        const { entries } = yield* fetchSources(sources, 15_000, Number.POSITIVE_INFINITY, true)
        expect(entries.map((e) => e.title)).toEqual(['B', 'A'])
        expect(fx.hits('/b') - before).toBe(1)
      }),
    ),
    15_000,
  )

  test(
    'two runs are deeply equal',
    eff(
      Effect.gen(function* () {
        const sources = [
          { title: 'A', url: `${fx.origin}/a` },
          { title: 'B', url: `${fx.origin}/b` },
        ]
        expect(yield* fetchSources(sources, 15_000, Number.POSITIVE_INFINITY, true)).toEqual(
          yield* fetchSources(sources, 15_000, Number.POSITIVE_INFINITY, true),
        )
      }),
    ),
    15_000,
  )
})
