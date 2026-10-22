// HTML extraction edge cases: SVG labels stay out of page text, and tables
// keep their caption, rowspan columns, and literal backslash-pipe text.
import { describe, expect, test } from 'bun:test'
import { htmlToArticle, htmlToMarkdown } from '../../src/lib/html.ts'

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
