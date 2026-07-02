// URL-identity contract: normalization for dedup + EXACT-host scoping.
// The multi-label-eTLD case (co.uk) needs no DNS — unit-covered here.
import { describe, expect, test } from 'bun:test'
import { normalizeUrl, sameHost } from '../../src/core/url.ts'

describe('normalizeUrl — canonical form for dedup', () => {
  test('strips fragments', () => {
    expect(normalizeUrl('https://x.dev/p#frag')).toBe('https://x.dev/p')
  })

  test('lowercases scheme and host, preserves path case', () => {
    expect(normalizeUrl('HTTPS://ExAmPle.COM/Path')).toBe('https://example.com/Path')
  })

  test('strips default ports', () => {
    expect(normalizeUrl('https://x.dev:443/')).toBe('https://x.dev/')
    expect(normalizeUrl('http://x.dev:80/a')).toBe('http://x.dev/a')
  })

  test('keeps non-default ports', () => {
    expect(normalizeUrl('http://x.dev:8080/a')).toBe('http://x.dev:8080/a')
  })

  test('canonicalizes the bare origin to the root path', () => {
    expect(normalizeUrl('https://x.dev')).toBe(normalizeUrl('https://x.dev/'))
  })

  test('resolves relative references against a base', () => {
    expect(normalizeUrl('../up', 'https://x.dev/a/b/')).toBe('https://x.dev/a/up')
    expect(normalizeUrl('d', 'https://x.dev/a/')).toBe('https://x.dev/a/d')
  })

  test('returns null for unparseable input', () => {
    expect(normalizeUrl('not a url')).toBeNull()
    expect(normalizeUrl('//missing-scheme')).toBeNull()
  })
})

describe('sameHost — exact hostname scoping', () => {
  test('accepts the exact host', () => {
    expect(sameHost('foo.co.uk', 'https://foo.co.uk/x')).toBe(true)
  })

  test('rejects a sibling under a multi-label eTLD (the apex bug)', () => {
    expect(sameHost('foo.co.uk', 'https://evil.co.uk/')).toBe(false)
  })

  test('rejects subdomain variants (exact scope by design)', () => {
    expect(sameHost('example.com', 'https://www.example.com/')).toBe(false)
  })

  test('is case-insensitive on hosts', () => {
    expect(sameHost('example.com', 'https://EXAMPLE.com/')).toBe(true)
  })

  test('rejects non-http and unparseable candidates', () => {
    expect(sameHost('x.dev', 'mailto:a@b.com')).toBe(false)
    expect(sameHost('x.dev', 'not a url')).toBe(false)
  })
})
