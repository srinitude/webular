// An answer is built from whole sentences: a page heading never leads or joins
// it, and the sentence that states the asked fact wins over the page intro.
import { expect, test } from 'bun:test'
import { answerPassage, isSentence } from '../../src/lib/answer-passage.ts'
import { leadFirst } from '../../src/workflows/answer.ts'

const page = [
  'Kestrel Bridge',
  'The Kestrel Bridge spans the Orrin River in the town of Valemont.',
  'The Kestrel Bridge opened to traffic in 1921 after six years of work.',
].join('\n')

test('a heading picked as the lead does not open the answer', () => {
  const top = ['The Kestrel Bridge opened to traffic in 1921 after six years of work.']
  expect(leadFirst(top, 'Kestrel Bridge', 2)).toEqual(top)
})

test('the passage skips headings and finds the sentence for the asked verb', () => {
  const picked = answerPassage([page], 1, { query: 'When did the Kestrel Bridge open?' })
  expect(picked).toEqual(['The Kestrel Bridge opened to traffic in 1921 after six years of work.'])
})

test('a sentence that ends in a citation marker still counts as a sentence', () => {
  expect(isSentence('Its height is 8,848.86 m (29,031.69 ft).[5]')).toBe(true)
  expect(isSentence('The notes were published in 1843.[1][2]')).toBe(true)
  expect(isSentence('It was measured as 8,848.86 m (29,031 ft 8+1⁄2 in).[')).toBe(true)
  expect(isSentence('Kestrel Bridge [edit]')).toBe(false)
})
