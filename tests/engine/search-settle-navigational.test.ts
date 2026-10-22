// Navigational settle contract, on a virtual clock: the Wikipedia list on a
// navigational query waits for a Wikidata lookup (the official site), so it
// is cut only by its own SOURCE_TIMEOUT_MS cap, never by the grace. Other
// queries keep the grace cut.
import { describe, expect, test } from 'bun:test'
import { Effect, Fiber } from 'effect'
import { TestClock } from 'effect/testing'
import { SETTLE_GRACE_MS, type SourceRunner, searchEffect } from '../../src/lib/search-chain.ts'
import { SOURCE_TIMEOUT_MS } from '../../src/lib/sources-search.ts'
import { eff } from '../_support/run.ts'

const hit = (url: string) => ({ title: url, url, description: '' })
const LATE_MS = SETTLE_GRACE_MS + 1_000

// Bench miss (search-mercury): Wikidata was slow on a cold run, the Wikipedia
// list landed after the grace, and mercurylang.org was cut.
const lateWikipedia: SourceRunner = (s) =>
  s === 'wikipedia'
    ? Effect.as(Effect.sleep(LATE_MS), [hit('https://mercurylang.org')])
    : s === 'openalex'
      ? Effect.never
      : Effect.succeed([hit(`https://${s}.dev/off-topic`)])

const settled = (query: string) =>
  Effect.gen(function* () {
    const fiber = yield* Effect.forkChild(
      searchEffect('web', query, 10, { runSource: lateWikipedia }),
    )
    yield* TestClock.adjust(SOURCE_TIMEOUT_MS + 100)
    return yield* Fiber.join(fiber)
  }).pipe(Effect.scoped, Effect.provide(TestClock.layer()))

describe('searchEffect — navigational Wikipedia outlasts the grace', () => {
  test(
    'a late Wikipedia list inside its cap joins a navigational query',
    eff(
      Effect.map(settled('Mercury programming language official website'), ({ results, meta }) => {
        expect(meta.sources['wikipedia']?.status).toBe('ok')
        expect(results.map((h) => h.url)).toContain('https://mercurylang.org')
        expect(meta.sources['openalex']?.status).toBe('timeout')
      }),
    ),
  )
  test(
    'a late Wikipedia list is still cut on other queries',
    eff(
      Effect.map(settled('Mercury programming language'), ({ meta }) =>
        expect(meta.sources['wikipedia']?.status).toBe('timeout'),
      ),
    ),
  )
})
