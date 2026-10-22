// URL identity edge cases: two spellings of one page must normalize alike,
// and host scoping must match a Unicode host to its punycode form.
import { expect, test } from 'bun:test'
import { canonicalUrl, normalizeUrl, sameHost } from '../../src/core/url.ts'

test('percent-escape case does not split one page into two', () => {
  expect(normalizeUrl('https://x.dev/%7euser/a%2fb')).toBe(
    normalizeUrl('https://x.dev/%7Euser/a%2Fb'),
  )
})

test('Google linker and click ids are stripped like utm_*', () => {
  expect(normalizeUrl('https://x.dev/p?_gl=1*abc&gbraid=x&wbraid=y&id=7')).toBe(
    'https://x.dev/p?id=7',
  )
})

test('a Unicode host scopes to its punycode URLs', () => {
  expect(sameHost('bücher.de', 'https://xn--bcher-kva.de/a')).toBe(true)
  expect(sameHost('BÜCHER.de', 'https://bücher.de/a')).toBe(true)
})

test('a relative canonical resolves against <base href>', () => {
  const html = '<head><base href="https://x.dev/docs/"><link rel="canonical" href="intro"></head>'
  expect(canonicalUrl(html, 'https://x.dev/old/page')).toBe('https://x.dev/docs/intro')
})
