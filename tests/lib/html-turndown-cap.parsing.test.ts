// HTML past 5 MB is cut before Turndown, whose regexes run superlinear on
// huge inputs (turndown #505, #506): text beyond the cap never reaches it.
import { expect, test } from 'bun:test'
import { htmlToMarkdown } from '../../src/lib/html.ts'

test('a page past 5 MB converts only its first 5 MB', () => {
  const filler = `<p>${'a'.repeat(5_000_000)}</p>`
  const markdown = htmlToMarkdown(`${filler}<p>beyond-the-cap</p>`)
  expect(markdown).not.toContain('beyond-the-cap')
  expect(markdown.startsWith('aaaa')).toBe(true)
})
