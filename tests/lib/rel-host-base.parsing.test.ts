// Multi-token rel, trailing-dot hosts, and <base href> for images.
import { expect, test } from 'bun:test'
import { canonicalUrl, sameHost } from '../../src/core/url.ts'
import { parsePage } from '../../src/lib/html.ts'

test('canonical is found in a multi-token, mixed-case rel', () => {
  const html = '<link rel="Canonical alternate" href="https://x.dev/real">'
  expect(canonicalUrl(html, 'https://x.dev/page?a=1')).toBe('https://x.dev/real')
})

test('a trailing-dot host matches the plain host', () => {
  expect(sameHost('example.com.', 'https://example.com/a')).toBe(true)
  expect(sameHost('example.com', 'https://example.com./a')).toBe(true)
  expect(sameHost('example.com', 'https://other.com/a')).toBe(false)
})

test('canonical on a trailing-dot host of the same site is kept', () => {
  const html = '<link rel="canonical" href="https://x.dev./real">'
  expect(canonicalUrl(html, 'https://x.dev/page')).toBe('https://x.dev./real')
})

test('image URLs resolve against <base href>', () => {
  const html =
    '<html><head><base href="/assets/"><meta property="og:image" content="og.png"></head>' +
    '<body><img src="a.png" alt="a"></body></html>'
  const page = parsePage(html, 'https://x.dev/page')
  expect(page.images[0]?.src).toBe('https://x.dev/assets/a.png')
  expect(page.ogImage).toBe('https://x.dev/assets/og.png')
})
