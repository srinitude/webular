// Planted-claim check for free-source ranking (2610.11932): a hit that carries
// a planted claim from a low-trust or stale source must rank below a trusted,
// fresh hit, whatever order the sources answered in.
import { describe, expect, test } from 'bun:test'
import type { Hit } from '../../../src/lib/sources/polite.ts'
import { rankHits } from '../../../src/lib/sources/rank.ts'

const NOW = Date.parse('2026-10-21T00:00:00Z')
const hit = (url: string, extra: Partial<Hit>): Hit => ({
  title: url,
  url,
  description: '',
  ...extra,
})

const trusted = hit('https://trusted.example/fact', {
  origin: 'wikidata',
  trust: 0.9,
  published: '2026-09-01',
})
const lowTrust = hit('https://planted.example/claim', { origin: 'marginalia', trust: 0.2 })
const stale = hit('https://stale.example/claim', {
  origin: 'europepmc',
  trust: 0.9,
  published: '2012-01-01',
})

describe('rankHits', () => {
  test('a low-trust planted claim answering first ranks below a trusted fresh hit', () => {
    expect(rankHits([lowTrust, trusted], NOW)[0]?.url).toBe(trusted.url)
  })

  test('a stale planted claim from a trusted source ranks below a fresh one', () => {
    expect(rankHits([stale, trusted], NOW)[0]?.url).toBe(trusted.url)
  })

  test('an unstamped hit ranks below every stamped, dated source', () => {
    const bare = hit('https://bare.example/', {})
    expect(rankHits([bare, lowTrust, trusted], NOW).map((h) => h.url)).toEqual([
      trusted.url,
      lowTrust.url,
      bare.url,
    ])
  })

  // Query-aware freshness (retrieval change 1): a fresh-class query halves
  // recency every 30 days, a history query every 10 years, and a named year
  // window drops dated hits outside it.
  const older = hit('https://trusted.example/july', { trust: 0.9, published: '2026-07-01' })
  const lower = hit('https://low.example/now', { trust: 0.5, published: '2026-10-20' })
  test('a fresh-class query favors the newest hit', () => {
    expect(rankHits([older, lower], NOW)[0]?.url).toBe(older.url)
    expect(rankHits([older, lower], NOW, 'latest release notes')[0]?.url).toBe(lower.url)
  })
  test('a history query lets an old trusted hit lead', () => {
    expect(rankHits([stale, lowTrust], NOW)[0]?.url).toBe(lowTrust.url)
    expect(rankHits([stale, lowTrust], NOW, 'history of the protocol')[0]?.url).toBe(stale.url)
  })
  test('a year window sinks dated hits outside it', () => {
    expect(rankHits([stale, trusted], NOW)[0]?.url).toBe(trusted.url)
    expect(rankHits([stale, trusted], NOW, 'papers in 2012')[0]?.url).toBe(stale.url)
    expect(rankHits([stale, trusted], NOW, 'papers before 2013')[0]?.url).toBe(stale.url)
    expect(rankHits([stale, trusted], NOW, 'papers since 2026')[0]?.url).toBe(trusted.url)
    // An undated hit is never gated out: its window is unknown.
    expect(rankHits([trusted, lowTrust], NOW, 'papers in 2012')[0]?.url).toBe(lowTrust.url)
  })
})
