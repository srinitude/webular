// Question-focused picking: with a question, the summarizer prefers sentences
// that hold the question's rarer key terms plus the main entity, so a bio page
// full of "uncertainty principle" still answers where the physicist was born.
import { expect, test } from 'bun:test'
import { summarizeText } from '../../src/lib/summarize.ts'

const PAGE = [
  'Werner Karl Heisenberg was a German theoretical physicist and a pioneer of quantum mechanics.',
  'He published his uncertainty principle in 1927, and the uncertainty principle made him famous.',
  'The uncertainty principle limits how well position and momentum can be known together.',
  'Heisenberg was born in Würzburg, Germany, to Kaspar Ernst August Heisenberg and Annie Wecklein.',
  'Physicists still debate the uncertainty principle and its meaning for physics and measurement.',
  'Heisenberg was awarded the Nobel Prize in Physics for the creation of quantum mechanics.',
  'Quantum mechanics and the uncertainty principle changed physics for every physicist who followed.',
].join(' ')
const RIDDLE = 'In which city was the physicist who formulated the uncertainty principle born?'

test('a question picks the sentence with its rare key term and the entity', () => {
  const { summary } = summarizeText(PAGE, 3, { query: RIDDLE, entity: 'Werner Heisenberg' })
  expect(summary).toContain('Würzburg')
})

// The live page cites Max Born over and over; "Born" the name must not make
// the verb "born" look common, or two-word physicist lines push the birth out.
test('a surname that spells a lowercase question word does not bury the answer', () => {
  const cites = Array.from(
    { length: 12 },
    (_, i) => `Born, M.; Heisenberg, W.; Jordan, P. (19${10 + i}).`,
  )
  const physicists = Array.from(
    { length: 6 },
    (_, i) => `The physicist Max Born wrote to Heisenberg in letter ${i + 1} about matrices.`,
  )
  const page = [
    'Werner Karl Heisenberg was a German theoretical physicist.',
    ...physicists,
    'Werner Karl Heisenberg was born in Würzburg, Germany, the son of Kaspar Heisenberg.',
    ...cites,
  ].join(' ')
  const { summary } = summarizeText(page, 3, { query: RIDDLE, entity: 'Werner Heisenberg' })
  expect(summary).toContain('Würzburg')
})

test('the plain frequency picker misses it, which is why focus exists', () => {
  expect(summarizeText(PAGE, 3).summary).not.toContain('Würzburg')
})
