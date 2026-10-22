// Source ranking: hit rate / (1 + latency EMA / 1500 ms), kept in an Effect
// service (arXiv 2605.14241); per-class constant weights for weighted RRF
// (arXiv 2610.24341, 2503.20698, 2609.18248); route by source class first
// (arXiv 2607.03028).
import { describe, expect, test } from 'bun:test'
import { Deferred, Effect } from 'effect'
import { searchEffect } from '../../src/lib/search-chain.ts'
import { SEARCH_SOURCES } from '../../src/lib/search-source-names.ts'
import { querySource } from '../../src/lib/search-source-run.ts'
import {
  CLASS_WEIGHT,
  classOf,
  SourceStats,
  sourceScore,
  weightedRrf,
} from '../../src/lib/search-source-score.ts'
import { eff } from '../_support/run.ts'

const hit = { title: 't', url: 'https://a.com', description: '' }
const settle = Effect.gen(function* () {
  return { hit: yield* Deferred.make<void>(), cutoff: Effect.never }
})

describe('sourceScore', () => {
  test('is hit rate over one plus latency in 1500 ms units', () => {
    expect(sourceScore(0.9, 1500)).toBeCloseTo(0.45)
    expect(sourceScore(0.5, 0)).toBeCloseTo(0.5)
  })
  test('a fast bad source never outranks a good slow one', () => {
    expect(sourceScore(0.1, 0)).toBeLessThan(sourceScore(0.9, 1500))
  })
})

describe('SourceStats', () => {
  test(
    'ranks by observed hit rate and latency, not by call order',
    eff(
      Effect.gen(function* () {
        const stats = yield* SourceStats
        yield* stats.record('web', 'no-results', 100)
        yield* stats.record('arxiv', 'ok', 1200)
        expect((yield* stats.rank(['web', 'arxiv', 'npm'])).slice(0, 2)).toEqual(['arxiv', 'npm'])
      }).pipe(Effect.provide(SourceStats.layer)),
    ),
  )
  test(
    'querySource records its run when the service is present',
    eff(
      Effect.gen(function* () {
        const stats = yield* SourceStats
        const s = yield* settle
        yield* querySource('npm', ['q'], 5, () => Effect.succeed([hit]), s)
        yield* querySource('web', ['q'], 5, () => Effect.succeed([]), s)
        expect((yield* stats.rank(['web', 'npm']))[0]).toBe('npm')
      }).pipe(Effect.provide(SourceStats.layer)),
    ),
  )
  test(
    'querySource still runs with no service',
    eff(
      Effect.gen(function* () {
        const r = yield* querySource('npm', ['q'], 5, () => Effect.succeed([]), yield* settle)
        expect(r.status).toBe('no-results')
      }),
    ),
  )
})

describe('source classes', () => {
  test('every search source has a class with a positive constant weight', () => {
    for (const s of SEARCH_SOURCES) expect(CLASS_WEIGHT[classOf(s)]).toBeGreaterThan(0)
  })
  test('weighted RRF is the class weight over 60 + rank + 1', () => {
    expect(weightedRrf('arxiv', 0)).toBeCloseTo(CLASS_WEIGHT.scholarly / 61)
    expect(weightedRrf('web', 4)).toBeCloseTo(CLASS_WEIGHT.web / 65)
  })
})

describe('weighted fusion through search', () => {
  // General intent asks hackernews before openalex; unweighted RRF ties their
  // first places and keeps hackernews first. The scholarly weight (1) beats
  // the community weight (0.8), so openalex's hit leads.
  const page = (url: string) => [{ title: url, url, description: '' }]
  const lists: Record<string, ReturnType<typeof page>> = {
    hackernews: page('https://news.example/a'),
    openalex: page('https://paper.example/b'),
  }
  const runSource = (s: string) => Effect.succeed(lists[s] ?? [])
  test(
    'a scholarly first place outranks a community first place',
    eff(
      Effect.gen(function* () {
        const { results } = yield* searchEffect('web', 'quiet garden tips', 5, { runSource })
        expect(results.map((r) => r.url)).toEqual([
          'https://paper.example/b',
          'https://news.example/a',
        ])
      }),
    ),
  )
})
