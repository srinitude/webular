// Search ranking contract: reciprocal rank fusion + official-domain signal +
// URL dedupe. Pure functions, no network.
import { describe, expect, test } from 'bun:test'
import { domainSignal, hitKey, lexicalRerank, rankHits } from '../../src/lib/search.ts'

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

describe('lexicalRerank — query overlap with title, host, and snippet', () => {
  const h = (url: string, title: string, description = '') => ({ title, url, description })

  test('a hit that matches the query terms beats an off-topic hit ranked above it', () => {
    const hits = [
      h('https://blog.example.com/a', 'Cooking pasta at home', 'Boil water and salt it.'),
      h(
        'https://example.org/b',
        'Fredericton city guide',
        'Fredericton is the capital of New Brunswick.',
      ),
    ]
    expect(urls(lexicalRerank(hits, 'Fredericton')).at(0)).toBe('https://example.org/b')
  })

  test('the entity host and Wikipedia outrank a plain title match', () => {
    const hits = [
      h('https://news.example.com/x', 'Tychy news', 'Tychy tychy tychy'),
      h('https://pl.wikipedia.org/wiki/Tychy', 'Tychy', ''),
      h('https://www.tychy.pl/', 'Miasto Tychy', ''),
    ]
    expect(urls(lexicalRerank(hits, 'Tychy')).slice(0, 2).sort()).toEqual(
      ['https://pl.wikipedia.org/wiki/Tychy', 'https://www.tychy.pl/'].sort(),
    )
  })

  test('words from any script count, and equal scores keep the merged order', () => {
    const hits = [
      h('https://a.jp/1', '東京'),
      h('https://b.jp/2', '大阪'),
      h('https://c.jp/3', '東京'),
    ]
    expect(urls(lexicalRerank(hits, '東京'))).toEqual([
      'https://a.jp/1',
      'https://c.jp/3',
      'https://b.jp/2',
    ])
    expect(urls(lexicalRerank(hits, 'zzz'))).toEqual(urls(hits))
  })
})
