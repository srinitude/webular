// Contract: the search gold-set eval counts a hit only when a gold URL, after
// normalization, sits in the first 10 distinct result URLs. Offline.
import { expect, test } from 'bun:test'
import { hitAt10 } from '../../scripts/bench/search-gold.ts'

test('a normalized gold URL in the top 10 is a hit', () => {
  expect(hitAt10('{"url":"https://www.fredericton.ca/fr/"}', ['https://fredericton.ca/fr'])).toBe(
    true,
  )
})

test('a gold URL past rank 10 or absent is a miss', () => {
  const eleven = Array.from({ length: 11 }, (_, i) => `https://e${i}.org/`).join(' ')
  expect(hitAt10(eleven, ['https://e10.org'])).toBe(false)
  expect(hitAt10('', ['https://e0.org'])).toBe(false)
})
