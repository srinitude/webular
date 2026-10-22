// When Readability keeps only a thin scrap of a readerable page, the body
// text comes back instead, so the code and math it skipped still reach the user.
import { expect, test } from 'bun:test'
import { htmlToArticle } from '../../src/lib/html.ts'

const long = 'Body words that say something real about the topic at hand. '.repeat(10)
const code = 'const area = Math.PI * r ** 2'
const math = 'E = mc^2'
// Readability always drops an aria-modal dialog, so it keeps only the short note.
const html =
  '<html><head><title>T</title></head><body><main><p>A short note on the page.</p></main>' +
  `<div role="dialog" aria-modal="true"><p>${long}</p><pre><code>${code}</code></pre>` +
  `<math><mi>${math}</mi></math></div></body></html>`

test('a thin Readability pick falls back to the fuller body text with code and math', () => {
  const { text } = htmlToArticle(html)
  expect(text).toContain(long.trim())
  expect(text).toContain(code)
  expect(text).toContain(math)
})
