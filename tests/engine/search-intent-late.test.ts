// The intent pick never holds up the fan-out: the keyword rule's sources start
// at once, and Jev's pick (a recorded sure reply, landing late) adds the sources
// it names. A judge that never answers is dropped at the settle cutoff.
import { expect, test } from 'bun:test'
import { Clock, Effect, Layer } from 'effect'
import { Jev, type JevResult } from '../../src/lib/jev/client.ts'
import { intentBaseline, intentDecision } from '../../src/lib/jev/decisions/search-intent.ts'
import { SETTLE_GRACE_MS, type SourceRunner, searchEffect } from '../../src/lib/search-chain.ts'
import { pickSourcesJudged } from '../../src/lib/search-intent.ts'
import { eff } from '../_support/run.ts'

const QUERY = 'how to install zod'
const JEV_MS = 400
const hit = (url: string) => ({ title: url, url, description: '' })

// Both option orders agree on software at 0.99.
const sure = { choice: 'software', confidence: 0.99 }
const recorded = Layer.succeed(Jev)(
  Jev.of({
    available: true,
    ask: () =>
      Effect.succeed({ answers: { intent: sure, intent_swapped: sure } } as unknown as JevResult),
  }),
)
const lateJev = (q: string) =>
  pickSourcesJudged(q, (i) =>
    intentDecision(i).pipe(Effect.provide(recorded), Effect.orDie, Effect.delay(JEV_MS)),
  )

// Wikipedia answers at once, OpenAlex stalls, npm holds the official homepage.
const runner: SourceRunner = (s) =>
  s === 'npm'
    ? Effect.succeed([hit('https://zod.dev')])
    : s === 'openalex'
      ? Effect.never
      : Effect.succeed([hit(`https://${s}.dev/zod`)])

const lateSoftware = Effect.gen(function* () {
  expect(intentBaseline({ query: QUERY })).toBe('general')
  const t0 = yield* Clock.currentTimeMillis
  const { results, meta } = yield* searchEffect('web', QUERY, 10, {
    runSource: runner,
    judge: lateJev,
  })
  const ms = (yield* Clock.currentTimeMillis) - t0
  expect(meta.sources['wikipedia']?.ms ?? JEV_MS).toBeLessThan(JEV_MS)
  expect(meta.sources['npm']?.status).toBe('ok')
  expect(results.map((h) => h.url)).toContain('https://zod.dev')
  expect(meta.sources['openalex']?.status).toBe('timeout')
  expect(ms).toBeLessThan(SETTLE_GRACE_MS + 300)
})

const silentJudge = Effect.gen(function* () {
  const t0 = yield* Clock.currentTimeMillis
  const { meta } = yield* searchEffect('web', QUERY, 10, {
    runSource: runner,
    judge: () => Effect.never,
  })
  expect((yield* Clock.currentTimeMillis) - t0).toBeLessThan(SETTLE_GRACE_MS + 300)
  expect(meta.sources['npm']).toBeUndefined()
  expect(meta.sources['wikipedia']?.status).toBe('ok')
})

// Only the keyword pick keeps npm uncut: npm added by Jev's late pick takes the
// settle cutoff, so a slow npm no longer runs to its cap on a general read.
const slowNpm: SourceRunner = (s, q, n) =>
  s === 'npm' ? Effect.delay(runner(s, q, n), 2_000) : runner(s, q, n)
const lateNpmCut = Effect.gen(function* () {
  const t0 = yield* Clock.currentTimeMillis
  const { meta } = yield* searchEffect('web', QUERY, 10, { runSource: slowNpm, judge: lateJev })
  expect((yield* Clock.currentTimeMillis) - t0).toBeLessThan(JEV_MS + SETTLE_GRACE_MS + 300)
  expect(meta.sources['npm']?.status).toBe('timeout')
  expect(meta.sources['wikipedia']?.status).toBe('ok')
})

test('a late sure Jev pick adds npm without holding up the keyword sources', eff(lateSoftware))
test('npm added by a late Jev pick is cut at the settle cutoff', eff(lateNpmCut))
test('a judge that never answers is dropped at the settle cutoff', eff(silentJudge))
