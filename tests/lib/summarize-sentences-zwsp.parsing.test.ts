// A zero-width space (U+200B) is not whitespace to String.trim, so it must be
// trimmed by name: a sentence that starts with one starts at its first letter.
import { expect, test } from 'bun:test'
import { splitSentences } from '../../src/lib/summarize-sentences.ts'

test('a leading U+200B is not part of the sentence span', () => {
  const text = '​First one. ​​Second one.'
  const { starts, ends } = splitSentences(text)
  expect(starts.map((s, i) => text.slice(s, ends[i]))).toEqual(['First one.', 'Second one.'])
})
