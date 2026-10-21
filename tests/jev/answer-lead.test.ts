// The direct-answer sentence Jev picks always opens the answer, without repeats.
import { expect, test } from 'bun:test'
import { leadFirst } from '../../src/workflows/answer.ts'

test('the lead opens the answer when it is already among the top sentences', () => {
  expect(leadFirst(['a', 'b', 'c'], 'c', 3)).toEqual(['c', 'a', 'b'])
})

test('a lead outside the top sentences replaces the last one', () => {
  expect(leadFirst(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b'])
})

test('no lead keeps the summarizer order', () => {
  expect(leadFirst(['a', 'b'], undefined, 2)).toEqual(['a', 'b'])
})
