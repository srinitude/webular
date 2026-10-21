// Long-page contract: answer candidates are ranked over the whole page before
// the 18-sentence cut, so an answer sentence deep in the page still reaches Jev.
import { expect, test } from 'bun:test'
import { answerCandidates } from '../../src/lib/jev/decisions/answer-sentences.ts'

const filler = (i: number) => `Section ${i} covers the museum gift shop and its opening hours.`

test('an answer sentence at position 40 is among the candidates', () => {
  const answer = 'The capital city of Spain is Madrid, seat of the Spanish government.'
  const page = Array.from({ length: 60 }, (_, i) => (i === 40 ? answer : filler(i))).join(' ')
  const candidates = answerCandidates('What is the capital city of Spain?', page)
  expect(candidates.length).toBeLessThanOrEqual(18)
  expect(candidates).toContain(answer)
})
