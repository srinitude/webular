// Source routing: a land survey or measurement question is not a scholarly
// query, so Wikipedia leads instead of arXiv and OpenAlex.
import { expect, test } from 'bun:test'
import { pickSources } from '../../src/lib/search-chain.ts'

const everest = 'What is the height of Mount Everest in meters according to the 2020 survey?'

test('a survey of a mountain routes to Wikipedia first, not arXiv', () => {
  const sources = pickSources(everest)
  expect(sources[0]).toBe('wikipedia')
  expect(sources).not.toContain('arxiv')
  expect(pickSources('transformer attention paper')).toContain('arxiv')
})
