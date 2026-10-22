// Readability's scoring pass is bounded: a page past READABLE_MAX_CHARS skips it
// and keeps its body text, so one huge page can't stall extraction.
import { expect, test } from 'bun:test'
import { htmlToArticle, READABLE_MAX_CHARS } from '../../src/lib/html.ts'

const para = `<p>${'Real article words about the topic, said plainly and at length. '.repeat(6)}</p>`
// Readability drops a "sidebar" block; the body-text path keeps it.
const page = (pad: string) =>
  `<html><head><title>T</title></head><body><article>${para.repeat(5)}</article><div class="sidebar">SIDEBAR-MARK</div><!--${pad}--></body></html>`

test('a page under the cap goes through Readability', () => {
  expect(htmlToArticle(page('')).text).not.toContain('SIDEBAR-MARK')
})

test('a page over the cap skips Readability and keeps its body text', () => {
  const text = htmlToArticle(page('x'.repeat(READABLE_MAX_CHARS))).text
  expect(text).toContain('SIDEBAR-MARK')
  expect(text).toContain('Real article words')
})
