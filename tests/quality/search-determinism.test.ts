// Code scorer for search determinism: the same query on the same recorded
// sources gives the same ranked hits, however the sources' timing falls.
import { expect, test } from 'bun:test'
import { ConfigProvider, Effect } from 'effect'
import { type SourceRunner, searchEffect } from '../../src/lib/search-chain.ts'
import { eff } from '../_support/run.ts'

const hit = (url: string) => ({ title: url, url, description: '' })

// Score 1 when every run ranks the same hits in the same order, else 0.
const determinismScore = (runs: ReadonlyArray<ReadonlyArray<string>>) =>
  new Set(runs.map((r) => r.join('\n'))).size === 1 ? 1 : 0

// Each source answers one hit with equal rank; the slow source's delay varies by run.
const runner =
  (slowMs: number): SourceRunner =>
  (s) =>
    s === 'hackernews'
      ? Effect.as(Effect.sleep(slowMs), [hit('https://a.dev/hn')])
      : s === 'wikipedia'
        ? Effect.succeed([hit('https://z.dev/wiki')])
        : Effect.succeed([])

test(
  'determinism scorer: deterministic mode ranks the same hits whatever the timing',
  eff(
    Effect.gen(function* () {
      const runs = yield* Effect.forEach([0, 50, 1500], (ms) =>
        searchEffect('web', 'bun runtime', 10, { runSource: runner(ms) }).pipe(
          Effect.map((r) => r.results.map((h) => h.url)),
        ),
      )
      expect(determinismScore(runs)).toBe(1)
    }).pipe(
      Effect.provide(
        ConfigProvider.layer(ConfigProvider.fromEnvRecord({ WEBULAR_DETERMINISTIC: '1' })),
      ),
    ),
  ),
)
