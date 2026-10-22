// A short page Readability skips keeps one line per block, so a heading never
// glues onto the first sentence of the paragraph after it in the page text.
import { expect, test } from 'bun:test'
import { htmlToArticle } from '../../src/lib/html.ts'

const html =
  '<!doctype html><html><head><title>Kestrel Bridge</title></head><body><article><h1>Kestrel Bridge</h1><p>The bridge spans the river.</p><p>It opened in 1921.</p></article></body></html>'

test('a heading and each paragraph stay on their own lines in page text', () => {
  expect(htmlToArticle(html).text).toBe(
    'Kestrel Bridge\nThe bridge spans the river.\nIt opened in 1921.',
  )
})
