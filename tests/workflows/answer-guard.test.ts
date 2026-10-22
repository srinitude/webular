// Answer guard contract: deterministic checks on the finished answer (no model call).
import { expect, test } from 'bun:test'
import { conflictNote, fetchedOnly, withBareLead } from '../../src/workflows/answer-guard.ts'

const src = (url: string, text: string) => ({ title: url, url, text })

test('a cited URL that was never fetched is dropped', () => {
  const used = [src('https://a.example/', 'A'), src('https://b.example/', 'B')]
  const cited = [src('https://a.example/', 'A'), src('https://ghost.example/', 'G')]
  expect(fetchedOnly(cited, used).map((e) => e.url)).toEqual(['https://a.example/'])
})

test('a year or count question leads with the one bare figure', () => {
  const lead = 'Apollo 11 landed on the Moon in 1969, after four days in flight.'
  expect(withBareLead('What year did Apollo 11 land on the Moon?', lead)).toBe(`1969. ${lead}`)
  expect(withBareLead('How many moons does Mars have?', 'Mars has 2 small moons.')).toBe(
    '2. Mars has 2 small moons.',
  )
  expect(withBareLead('What is the capital of Spain?', 'Madrid is the capital.')).toBe(
    'Madrid is the capital.',
  )
  expect(withBareLead('What year did it start?', 'It ran from 1914 to 1918.')).toBe(
    'It ran from 1914 to 1918.',
  )
})

test('sources whose answer sentences give different figures get a note', () => {
  const q = 'How many people live in Lisbon?'
  const a = src('https://a.example/', 'About 545,000 people live in Lisbon today.')
  const b = src('https://b.example/', 'About 505,000 people live in Lisbon today.')
  const note = conflictNote(q, [a, b])
  expect(note).toContain('Sources disagree')
  expect(note).toContain('https://a.example/')
  expect(note).toContain('https://b.example/')
  expect(conflictNote(q, [a, a])).toBe('')
  expect(conflictNote(q, [a])).toBe('')
})
