// HTML to Markdown edge cases: tables keep every cell in its column, and a
// <pre> with no <code> child stays a code block.
import { describe, expect, test } from 'bun:test'
import { htmlToMarkdown } from '../../src/lib/html.ts'
import { selectMatches } from '../../src/lib/select.ts'

describe('table rule', () => {
  test('colspan spreads a header cell over the columns it spans', () => {
    const md = htmlToMarkdown(
      '<table><tr><th colspan="2">Name</th><th>Age</th></tr>' +
        '<tr><td>A</td><td>B</td><td>1</td></tr></table>',
    )
    expect(md).toBe('| Name |  | Age |\n| --- | --- | --- |\n| A | B | 1 |')
  })

  test('a body row wider than the header keeps its extra cells', () => {
    const md = htmlToMarkdown('<table><tr><th>A</th></tr><tr><td>1</td><td>2</td></tr></table>')
    expect(md).toBe('| A |  |\n| --- | --- |\n| 1 | 2 |')
  })

  test('rows of a nested table are not repeated as outer rows', () => {
    const md = htmlToMarkdown(
      '<table><tr><th>outer</th></tr><tr><td>x<table><tr><td>in</td></tr></table></td></tr></table>',
    )
    expect(md.split('\n')).toHaveLength(3)
  })

  test('a line break inside a cell keeps the words apart', () => {
    const md = htmlToMarkdown('<table><tr><th>h</th></tr><tr><td>a<br>b</td></tr></table>')
    expect(md).toBe('| h |\n| --- |\n| a b |')
  })
})

describe('pre without code', () => {
  test('stays a fenced block with its whitespace and no escaping', () => {
    const md = htmlToMarkdown('<p>see</p><pre>line1\n  indented *x*\nline3</pre>')
    expect(md).toBe('see\n\n```\nline1\n  indented *x*\nline3\n```')
  })
})

describe('selector matches', () => {
  test('script and style inside a matched element stay out of its text', () => {
    const html = '<div class="a">Price <script>track()</script><style>.x{}</style>$5</div>'
    expect(selectMatches(html, '.a')).toEqual(['Price $5'])
  })
})
