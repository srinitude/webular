// The answer passage holds the answer, not just the topic: reference lines and
// page chrome drop out, the top entity page's lead sentence comes first, and a
// sentence naming an answer of the asked type (a person, a place) leads the rest.
// Fixtures follow benchmark misses; the check is the bench's folded `contains`.
import { expect, test } from 'bun:test'
import { answerPassage } from '../../src/lib/answer-passage.ts'
import { splitQuestion, summarizeText } from '../../src/lib/summarize.ts'

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const holds = (pages: string[], query: string, want: string) =>
  fold(answerPassage(pages, 3, { query }).join(' ')).includes(fold(want))

const TURING = [
  'The ACM A.M. Turing Award is an annual prize given by the Association for Computing Machinery for contributions of lasting and major technical importance to computer science.',
  'The award is named after Alan Turing, who was a British mathematician.',
  'The ACM raised the Turing Award prize several times over the years.',
  'Laureates: In 2023 Avi Wigderson, for foundational contributions to the theory of computation.',
  'In 2024 Andrew Barto and Richard Sutton, for the foundations of reinforcement learning.',
  'References "Turing Award". "ACM\'s Turing Award prize raised to $1 million". "ACM\'S Turing Award Prize Raised To $250,000". "ACM Turing Award winners".',
].join(' ')

test('a "who" question gets the named winner, not the citation line', () => {
  const q = 'Who received the ACM A.M. Turing Award for 2023?'
  expect(holds([TURING], q, 'Wigderson')).toBe(true)
  expect(answerPassage([TURING], 3, { query: q }).join(' ')).not.toContain('$250,000')
  expect(holds([TURING], 'Who received the ACM A.M. Turing Award for 2024?', 'Sutton')).toBe(true)
})

const JAMES = [
  'James is a 2024 novel by American author Percival Everett.',
  'It retells Adventures of Huckleberry Finn from the view of Jim, the enslaved man.',
  'The novel won the 2025 Pulitzer Prize for Fiction and the National Book Award for Fiction.',
  'The Pulitzer Prize for Fiction board praised the novel as a bold reimagining.',
  'Critics called the novel won praise for its humor and its anger.',
].join(' ')
const PRIZE =
  'The Pulitzer Prize for Fiction is one of the seven American Pulitzer Prizes that are annually awarded for Letters, Drama, and Music. The 2025 Pulitzer Prize for Fiction went to a novel. The Pulitzer Prize for Fiction has been awarded since 1918.'

test('a "which novel ... who wrote it" question names the author from the lead sentence', () => {
  const q = 'Which novel won the 2025 Pulitzer Prize for Fiction, and who wrote it?'
  expect(holds([JAMES, PRIZE], q, 'Percival Everett')).toBe(true)
})

const VIAZOVSKA = [
  'Archived from the original on 5 July 2022. From Wikipedia, the free encyclopedia Maryna Viazovska Born Maryna Sergiivna Viazovska 2 December 1984 Kyiv, Ukrainian SSR, Soviet Union Alma mater Kyiv University',
  'Maryna Sergiivna Viazovska (born 2 December 1984) is a Ukrainian mathematician known for her work in sphere packing.',
  'She was born in Kyiv, Ukraine, and studied at Kyiv University.',
  'In 2016 she solved the sphere packing problem in dimension 8, and with others in dimension 24.',
  'In 2022 she was awarded the Fields Medal for her work on sphere packing in dimensions 8 and 24.',
  'Retrieved 5 July 2022.',
].join(' ')

test('a "which country ... born" question gets the birthplace, without page chrome', () => {
  const q =
    'In which country was the 2022 Fields Medal winner who solved sphere packing in dimensions 8 and 24 born?'
  const passage = answerPassage([VIAZOVSKA], 3, { query: q }).join(' ')
  expect(fold(passage)).toContain('ukraine')
  expect(passage).not.toContain('Archived from the original')
  expect(passage).not.toContain('From Wikipedia')
})

// A describing clause ("who formulated the uncertainty principle") names the
// subject; its rare words must not outrank the asked relation ("born").
const HEISENBERG = [
  'Werner Karl Heisenberg (5 December 1901 – 1 February 1976) was a German theoretical physicist, one of the main pioneers of the theory of quantum mechanics.',
  'Heisenberg published his uncertainty principle in 1927, and the uncertainty principle made him famous.',
  'It was in Copenhagen, in 1927, that Heisenberg developed his uncertainty principle while working on the mathematical foundations of quantum mechanics.',
  'The uncertainty principle states a limit on the precision of certain pairs of physical quantities.',
  'Werner Karl Heisenberg was born in Würzburg, Germany, the son of a teacher of classical languages.',
  'In a letter to Wolfgang Pauli he set out the uncertainty principle for the first time.',
].join(' ')
const HEIS_Q = 'In which city was the physicist who formulated the uncertainty principle born?'

test('a describing clause does not outrank the asked verb, and an accented place counts', () => {
  expect(holds([HEISENBERG], HEIS_Q, 'Würzburg')).toBe(true)
})

test('focus ranking keeps the "born" sentence over clause-word sentences', () => {
  const top = summarizeText(HEISENBERG, 1, { query: HEIS_Q }).sentences.join(' ')
  expect(top).toContain('Würzburg')
})

test('a fronted question keeps its final verb as the asked part', () => {
  expect(splitQuestion(HEIS_Q).clause).toBe('who formulated the uncertainty principle')
  expect(splitQuestion(HEIS_Q).asked).toContain('born')
  expect(splitQuestion('Which novel won the prize, and who wrote it?').clause).toBe('')
  expect(splitQuestion('Who received the award?').clause).toBe('')
})
