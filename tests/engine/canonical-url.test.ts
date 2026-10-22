// One canonical URL for every dedupe and cache key: tracking params gone,
// params sorted, fragment dropped, and <link rel="canonical"> honored.
import { describe, expect, test } from 'bun:test'
import { canonicalUrl, normalizeUrl } from '../../src/core/url.ts'
import { hitKey } from '../../src/lib/search.ts'
import { dedupe } from '../../src/workflows/map.ts'

describe('normalizeUrl: shared canonical form', () => {
  test('strips tracking params and sorts the rest', () => {
    expect(normalizeUrl('HTTPS://X.dev:443/p?b=2&utm_source=n&a=1&fbclid=z&gclid=q#top')).toBe(
      'https://x.dev/p?a=1&b=2',
    )
  })

  test('a query of only tracking params leaves no "?"', () => {
    expect(normalizeUrl('https://x.dev/p?utm_medium=mail')).toBe('https://x.dev/p')
  })

  test('keeps ?ref=, which picks a branch or page', () => {
    const url = 'https://github.com/o/r/tree/x?ref=main'
    expect(normalizeUrl(url)).toBe(url)
  })
})

describe('callers share the key', () => {
  test('map dedupe folds tracking and order copies', () => {
    expect(
      dedupe(
        ['https://x.dev/p?a=1&b=2', 'https://x.dev/p?b=2&a=1', 'https://x.dev/p?a=1&b=2&utm_id=9'],
        10,
      ),
    ).toEqual(['https://x.dev/p?a=1&b=2'])
  })

  test('search hitKey ignores param order', () => {
    expect(hitKey('https://x.dev/p?b=2&a=1')).toBe(hitKey('https://www.x.dev/p?a=1&b=2'))
  })
})

describe('canonicalUrl: <link rel="canonical">', () => {
  test('resolves a relative canonical href against the page', () => {
    const html = `<head><link href="/post?utm_source=x" REL='Canonical'></head>`
    expect(canonicalUrl(html, 'https://x.dev/post/amp?ref=t')).toBe('https://x.dev/post')
  })

  test('falls back to the normalized page URL', () => {
    expect(canonicalUrl('<link rel="stylesheet" href="/a.css">', 'https://x.dev/p#x')).toBe(
      'https://x.dev/p',
    )
  })

  test('ignores an off-host canonical so crawl scope never moves', () => {
    expect(
      canonicalUrl('<link rel="canonical" href="https://evil.dev/p">', 'https://x.dev/p'),
    ).toBe('https://x.dev/p')
  })
})
