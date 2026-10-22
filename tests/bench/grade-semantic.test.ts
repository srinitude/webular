// Semantic answer scoring (answer-quality ledger rows): number grammar,
// answer extraction before alias match, hedges, and shotgun enumerations.
import { expect, test } from 'bun:test'
import { aliasMatch, aliasPass, normalizeText, runCheck } from '../../scripts/bench/grade.ts'
import { answerCandidate, isHedged, isShotgun, numbersIn } from '../../scripts/bench/grade-text.ts'

test('numbersIn reads separators without merging list items', () => {
  expect(numbersIn('1,358,000 people')).toEqual([1358000])
  expect(numbersIn('1 358 000')).toEqual([1358000])
  expect(numbersIn("1'358'000")).toEqual([1358000])
  expect(numbersIn('1.358.000')).toEqual([1358000])
  expect(numbersIn('ranks 1,2,3')).toEqual([1, 2, 3])
  expect(numbersIn('pi is 3.14')).toEqual([3.14])
})

test('numbersIn reads scientific notation and unicode superscripts', () => {
  expect(numbersIn('1.5 x 10^3 km')).toEqual([1500])
  expect(numbersIn('2×10³')).toEqual([2000])
  expect(numbersIn('3e-2')).toEqual([0.03])
  expect(numbersIn('6.02 × 10^23')).toEqual([6.02e23])
  expect(runCheck({ kind: 'numeric', value: 1500, tolerance: 0 }, '1.5 × 10^3')).toBe(true)
})

test('normalizeText folds the ampersand to "and"', () => {
  expect(normalizeText('Johnson & Johnson')).toBe(normalizeText('Johnson and Johnson'))
  expect(aliasMatch('It is Johnson and Johnson.', ['Johnson & Johnson'])).toBe(true)
})

test('answerCandidate takes the marked final answer over earlier text', () => {
  expect(answerCandidate('Not Paris.\n**Final answer:** Lyon')).toBe('Lyon')
  expect(answerCandidate('Answer - Rome\nThanks')).toBe('Rome')
  expect(answerCandidate('Paris is the capital of France.')).toBe('Paris is the capital of France.')
})

test('isHedged flags uncommitted answers', () => {
  expect(isHedged('It might be Paris or Lyon')).toBe(true)
  expect(isHedged("I'm not sure, perhaps Paris")).toBe(true)
  expect(isHedged('Paris')).toBe(false)
})

test('isShotgun flags short enumerations far above the gold size', () => {
  expect(isShotgun('Paris, Lyon, Nice, Lille, Metz, Rouen', 1)).toBe(true)
  expect(isShotgun('Sucre and La Paz', 3)).toBe(false)
  expect(isShotgun('Paris', 1)).toBe(false)
})

test('aliasPass matches the extracted answer, rejects hedges and shotguns, keeps verbose-correct', () => {
  expect(aliasPass('Not Paris.\nAnswer: Lyon', ['Paris'])).toBe(false)
  expect(aliasPass('Answer: Paris', ['Paris'])).toBe(true)
  expect(aliasPass('Perhaps Paris, not sure', ['Paris'])).toBe(false)
  expect(aliasPass('Paris, Lyon, Nice, Lille, Metz, Rouen', ['Paris'])).toBe(false)
  expect(aliasPass('Whatever', [])).toBe(true)
  const verbose = `${'Long background about the city, its river, its history. '.repeat(10)}It is Paris.`
  expect(aliasPass(verbose, ['Paris'])).toBe(true)
  expect(aliasPass('Sucre and La Paz', ['Sucre', 'La Paz', 'Sucre and La Paz'])).toBe(true)
})
