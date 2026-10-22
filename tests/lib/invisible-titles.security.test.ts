// Invisible and bidi-control characters must not survive into page titles,
// and the invisible-character set must cover the bidi embeddings and isolates.
import { expect, test } from 'bun:test'
import { parsePage, titleAndLinks } from '../../src/lib/html.ts'
import { dropInvisible } from '../../src/lib/html-sanitize.ts'

const sneaky = 'Pay‮pal⁦ Login⁩​'
const html = `<html><head><title>${sneaky}</title></head><body><h1>x</h1></body></html>`

test('dropInvisible strips bidi embeddings, overrides, and isolates', () => {
  expect(dropInvisible('a‪‫‬‭‮⁦⁧⁨⁩b')).toBe('ab')
})

test('titleAndLinks strips invisible characters from the title', () => {
  expect(titleAndLinks(html, 'https://example.com/').title).toBe('Paypal Login')
})

test('parsePage strips invisible characters from every title candidate', () => {
  const { titles } = parsePage(html, 'https://example.com/')
  expect(titles.document).toBe('Paypal Login')
})
