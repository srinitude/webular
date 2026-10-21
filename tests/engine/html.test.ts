// HTML reliability: the shared sanitizer, short-page text, and the empty-input fallback.
import { describe, expect, test } from 'bun:test'
import { htmlToArticle, sanitizeHtml } from '../../src/lib/html.ts'

describe('sanitizeHtml', () => {
  test('strips active elements, on* attributes, and javascript: URLs', () => {
    const out = sanitizeHtml(
      '<p onclick="x()">hi <a href=" java\tscript:alert(1)">a</a><a href="https://ok.test/">b</a></p>' +
        '<script>alert(1)</script><style>p{}</style><iframe src="//e"></iframe><object></object><embed><form><input></form>',
    )
    expect(out).not.toMatch(/script|style|iframe|object|embed|form|onclick|javascript/i)
    expect(out).toContain('https://ok.test/')
    expect(out).toContain('hi')
  })
})

describe('htmlToArticle', () => {
  test('a short page keeps its text and loses its scripts', () => {
    const article = htmlToArticle('<html><body><p>tiny</p><script>alert(1)</script></body></html>')
    expect(article.text).toBe('tiny')
    expect(article.contentHtml).toContain('tiny')
    expect(article.contentHtml).not.toMatch(/script/i)
  })

  test('empty input returns empty text instead of throwing', () => {
    expect(htmlToArticle('').text).toBe('')
  })
})
