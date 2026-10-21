// Wikipedia full-text search gets content words only: function words and "?"
// pushed Chimborazo above Mount Everest for the 2020-survey question.
import { expect, test } from 'bun:test'
import { keywordQuery } from '../../src/lib/sources-search.ts'

test('keywordQuery keeps content words and drops the question frame', () => {
  expect(
    keywordQuery('What is the height of Mount Everest in meters according to the 2020 survey?'),
  ).toBe('height Mount Everest 2020 survey')
  expect(
    keywordQuery('In which city was the physicist who formulated the uncertainty principle born?'),
  ).toBe('physicist formulated uncertainty principle')
  expect(keywordQuery('Who was it?')).toBe('it')
  expect(keywordQuery('the of')).toBe('the of')
})
