// HTML to Markdown edge cases: tables keep every cell in its column, and a
// <pre> with no <code> child stays a code block.
import { describe, expect, test } from 'bun:test'
import { htmlToMarkdown, sanitizeHtml } from '../../src/lib/html.ts'
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

  // Extraction #10: GFM has one header row, so stacked header rows join into
  // one header-path row and no column loses its parent header.
  test('two header rows join into one header-path row', () => {
    const md = htmlToMarkdown(
      '<table><thead><tr><th rowspan="2">Item</th><th colspan="2">Price</th></tr>' +
        '<tr><th>2024</th><th>2025</th></tr></thead><tr><td>A</td><td>1</td><td>2</td></tr></table>',
    )
    expect(md).toBe('| Item | Price / 2024 | Price / 2025 |\n| --- | --- | --- |\n| A | 1 | 2 |')
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

// MathML is dropped as foreign content, but the formula it shows is page text.
test('a formula keeps its words when the MathML element is stripped', () => {
  const out = sanitizeHtml(
    '<p>Energy: <math alttext="E = mc^2"><mi>E</mi></math></p>' +
      '<p>Area: <math><semantics><mi>A</mi><annotation encoding="application/x-tex">A = \\pi r^2</annotation></semantics></math></p>' +
      '<p>Sum: <math><mi>a</mi><mo>+</mo><mi>b</mi></math></p>',
  )
  expect(out).not.toMatch(/<math|<annotation/i)
  expect(out).toContain('E = mc^2')
  expect(out).toContain('A = \\pi r^2')
  expect(out).toContain('a+b')
})

// Some sites break code lines with <br> inside <pre>.
test('a <br> inside a code block stays a line break in Markdown', () => {
  const fenced = htmlToMarkdown('<pre><code>const a = 1<br>const b = 2</code></pre>')
  expect(fenced).toContain('const a = 1\nconst b = 2')
  const bare = htmlToMarkdown('<pre>line one<br/>line two</pre>')
  expect(bare).toContain('line one\nline two')
})

// Engineering #18: a Markdown image loads its URL as soon as it renders, so a
// page could leak data through it. Each image becomes a marked plain link.
test('an image becomes a marked link, and tag-block characters are gone', () => {
  const tag = String.fromCodePoint(0xe0041, 0xe0042)
  const md = htmlToMarkdown(`<p>Hi${tag} there</p><img src="https://x.test/p.png?k=1" alt="a]b">`)
  expect(md).toBe('Hi there\n\n[image: a\\]b](https://x.test/p.png?k=1)')
  expect(htmlToMarkdown('<img alt="no source">')).toBe('')
})
