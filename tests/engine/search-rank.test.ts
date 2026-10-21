// Search ranking contract: reciprocal rank fusion + official-domain signal +
// URL dedupe. Pure functions, no network.
import { describe, expect, test } from 'bun:test'
import { domainSignal, hitKey, rankHits } from '../../src/lib/search.ts'

const hit = (url: string) => ({ title: url, url, description: '' })
const urls = (hits: ReadonlyArray<{ url: string }>) => hits.map((h) => h.url)

describe('rankHits — official site above Wikipedia and aggregators', () => {
  test('the official domain outranks a higher-placed Wikipedia hit', () => {
    const list = [
      hit('https://en.wikipedia.org/wiki/Bun_(software)'),
      hit('https://www.reddit.com/r/bun'),
      hit('https://blog.example.com/bun-review'),
      hit('https://bun.sh/docs'),
    ]
    expect(urls(rankHits([list], 'bun runtime'))[0]).toBe('https://bun.sh/docs')
  })

  test('a hyphenated term matches the domain label and its GitHub home', () => {
    expect(domainSignal('https://effect.website/', 'effect-ts')).toBeGreaterThan(0)
    expect(domainSignal('https://github.com/Effect-TS/effect', 'effect-ts')).toBeGreaterThan(0)
    expect(domainSignal('https://www.npmjs.com/package/linkedom', 'linkedom')).toBeGreaterThan(0)
    expect(domainSignal('https://en.wikipedia.org/wiki/Effect', 'effect-ts')).toBeLessThan(0)
    expect(domainSignal('https://example.com/effect', 'effect-ts')).toBe(0)
  })

  test('fusion sums 1/(60+rank) across lists and dedupes normalized URLs', () => {
    const a = [hit('https://x.dev/a'), hit('https://www.y.dev/b/?utm_source=z')]
    const b = [hit('https://y.dev/b'), hit('https://x.dev/a/')]
    const fused = rankHits([a, b], 'unrelated words')
    expect(fused).toHaveLength(2)
    expect(hitKey('https://www.y.dev/b/?utm_source=z&q=1')).toBe('y.dev/b?q=1')
  })

  test('with no signal, a single list keeps its order', () => {
    const list = [hit('https://a.dev/1'), hit('https://b.dev/2'), hit('https://c.dev/3')]
    expect(urls(rankHits([list], 'zzz qqq'))).toEqual(urls(list))
  })
})
