// A fetched source carries its JSON-LD datePublished as an ISO date, so
// research output can say how fresh each source is; no date means no field.
import { expect, test } from 'bun:test'
import { textAndImages } from '../../src/lib/html.ts'

const body = '<p>Words about the topic.</p>'
const ld = (json: string) =>
  `<html><head><script type="application/ld+json">${json}</script></head><body>${body}</body></html>`

test('JSON-LD datePublished becomes an ISO published date', () => {
  const html = ld('{"@type":"Article","datePublished":"2024-05-01T08:00:00Z"}')
  expect(textAndImages(html, 'https://example.com/').published).toBe('2024-05-01T08:00:00.000Z')
})

test('a page with no date, or an unreadable one, has no published field', () => {
  expect('published' in textAndImages(`<html><body>${body}</body></html>`, '')).toBe(false)
  expect('published' in textAndImages(ld('{"datePublished":"soon"}'), '')).toBe(false)
})
