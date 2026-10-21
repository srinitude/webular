// Search settle contract: once one source has hits, a stalled source costs
// SETTLE_GRACE_MS, not SOURCE_TIMEOUT_MS; a source inside the grace still joins.
// npm is never cut by the grace: on a navigational software query it is the
// only source that returns the official homepage.
import { describe, expect, test } from 'bun:test'
import { Clock, Effect } from 'effect'
import { SETTLE_GRACE_MS, type SourceRunner, searchEffect } from '../../src/lib/search-chain.ts'
import { eff } from '../_support/run.ts'

const hit = (url: string) => ({ title: url, url, description: '' })

const settlesAfterFirstHit = Effect.gen(function* () {
  const runner: SourceRunner = (s) =>
    s === 'wikipedia'
      ? Effect.succeed([hit('https://a.dev/wiki')])
      : s === 'hackernews'
        ? Effect.as(Effect.sleep(SETTLE_GRACE_MS / 2), [hit('https://b.dev/hn')])
        : Effect.never
  const t0 = yield* Clock.currentTimeMillis
  const { results, meta } = yield* searchEffect('web', 'bun runtime', 10, { runSource: runner })
  expect((yield* Clock.currentTimeMillis) - t0).toBeLessThan(SETTLE_GRACE_MS + 400)
  expect(results.map((h) => h.url)).toContain('https://b.dev/hn')
  expect(meta.sources['openalex']?.status).toBe('timeout')
})

// Bench miss (search-bun-runtime): Wikipedia and Hacker News answered with
// off-topic hits first, npm answered after the grace, and bun.com was cut.
const npmOutlastsGrace = Effect.gen(function* () {
  const runner: SourceRunner = (s) =>
    s === 'npm'
      ? Effect.as(Effect.sleep(SETTLE_GRACE_MS + 300), [hit('https://bun.com')])
      : s === 'openalex'
        ? Effect.never
        : Effect.succeed([hit(`https://${s}.dev/off-topic`)])
  const { results, meta } = yield* searchEffect('web', 'Bun JavaScript runtime official site', 10, {
    runSource: runner,
  })
  expect(meta.sources['npm']?.status).toBe('ok')
  expect(results.map((h) => h.url)).toContain('https://bun.com')
  expect(meta.sources['openalex']?.status).toBe('timeout')
})

describe('searchEffect — settles after the first hit', () => {
  test('a stalled source is cut at the grace', eff(settlesAfterFirstHit))
  test('npm is not cut at the grace on a software query', eff(npmOutlastsGrace))
})
