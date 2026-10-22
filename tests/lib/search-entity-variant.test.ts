import { expect, test } from 'bun:test'
import { entityVariant } from '../../src/lib/search-chain.ts'

test('entityVariant strips a leading question, leaves other queries alone', () => {
  expect(entityVariant('what is Bruges')).toEqual(['Bruges'])
  expect(entityVariant('Who was the Beatles')).toEqual(['Beatles'])
  expect(entityVariant('Bruges')).toEqual([])
  expect(entityVariant('what is Bruges?')).toEqual([])
})
