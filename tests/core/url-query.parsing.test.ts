// The query survives byte for byte; only tracking params are removed.
import { expect, test } from 'bun:test'
import { normalizeUrl } from '../../src/core/url.ts'

test('a bare key and %20 stay as written', () => {
  expect(normalizeUrl('https://x.dev/p?foo')).toBe('https://x.dev/p?foo')
  expect(normalizeUrl('https://x.dev/p?q=a%20b&z=1&a=2')).toBe('https://x.dev/p?q=a%20b&z=1&a=2')
})

test('tracking params drop and the rest keep order and spelling', () => {
  expect(normalizeUrl('https://x.dev/p?utm_source=a&foo&gclid=1&q=a%20b')).toBe(
    'https://x.dev/p?foo&q=a%20b',
  )
  expect(normalizeUrl('https://x.dev/p?fbclid=1')).toBe('https://x.dev/p')
})
