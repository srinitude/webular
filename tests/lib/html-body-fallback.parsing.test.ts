// When Readability finds no main text on a readerable page, the page's body
// text comes back instead of '', so research and answer keep the source.
import { expect, test } from 'bun:test'
import { htmlToArticle, textAndImages } from '../../src/lib/html.ts'

const long = 'Body words that say something real about the topic at hand. '.repeat(10)
// The long paragraph makes the page readerable; Readability always drops an
// aria-modal dialog, so it scores no main text at all and returns null.
const html = `<html><head><title>T</title></head><body><div role="dialog" aria-modal="true"><p>${long}</p></div></body></html>`

test('no main text from Readability falls back to the body text', () => {
  expect(htmlToArticle(html).text).toBe(long.trim())
  expect(textAndImages(html, 'https://example.com/').text).toBe(long.trim())
})
