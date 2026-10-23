// HTML extraction edge cases: SVG labels stay out of page text, and tables
// keep their caption, rowspan columns, and literal backslash-pipe text; a
// table row also reads as "Header: value" pairs.
import { describe, expect, test } from 'bun:test'
import { htmlToArticle, htmlToMarkdown, textAndImages } from '../../src/lib/html.ts'

describe('page text', () => {
  test('an inline SVG title is not page text', () => {
    const { text } = htmlToArticle(
      '<html><body><p>Hello there</p><svg><title>Menu icon</title><desc>bars</desc></svg></body></html>',
    )
    expect(text).toContain('Hello there')
    expect(text).not.toContain('Menu icon')
    expect(text).not.toContain('bars')
  })
})

describe('table rule', () => {
  test('a caption is kept above the table', () => {
    const md = htmlToMarkdown(
      '<table><caption>Prices</caption><tr><th>a</th></tr><tr><td>1</td></tr></table>',
    )
    expect(md).toBe('Prices\n\n| a |\n| --- |\n| 1 |')
  })

  test('a rowspan cell keeps the next row in its own columns', () => {
    const md = htmlToMarkdown(
      '<table><tr><th>k</th><th>v</th></tr>' +
        '<tr><td rowspan="2">A</td><td>1</td></tr><tr><td>2</td></tr></table>',
    )
    expect(md).toBe('| k | v |\n| --- | --- |\n| A | 1 |\n|  | 2 |')
  })

  test('a literal backslash before a pipe stays one cell', () => {
    const md = htmlToMarkdown('<table><tr><th>h</th></tr><tr><td>c\\|d</td></tr></table>')
    expect(md).toBe('| h |\n| --- |\n| c\\\\\\|d |')
  })
})

describe('table rows', () => {
  test('a row under stacked headers reads as "Header: value" pairs', () => {
    const { rows } = textAndImages(
      '<html><body><table><tr><th rowspan="2">Item</th><th colspan="2">Price</th></tr>' +
        '<tr><th>2024</th><th>2025</th></tr><tr><td>Tea</td><td>1</td><td>2</td></tr></table></body></html>',
      'https://example.com/',
    )
    expect(rows).toContain('Item: Tea; Price / 2024: 1; Price / 2025: 2.')
    expect(rows).not.toContain('Tea 1 2.')
  })
})
