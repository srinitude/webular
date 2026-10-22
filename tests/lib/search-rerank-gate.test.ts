// Rerank skip gate: skip the BM25 rerank only when lists agree on a clear top hit.
import { expect, test } from 'bun:test'
import { clearLead } from '../../src/lib/search-diversify.ts'

const hit = { title: 't', url: 'https://a.example/', description: '' }
const row = (score: number, lists: number[], rank: number) => ({ hit, score, lists, rank })

test('a top hit that two sources agree on and that clearly leads keeps its fused order', () => {
  expect(clearLead([row(2 / 61, [0, 1], 1), row(1 / 62, [0], 2)])).toBe(true)
})

test('a top hit from one source, or with a narrow lead, still gets the rerank', () => {
  expect(clearLead([row(2 / 61, [0], 1), row(0, [1], 2)])).toBe(false)
  expect(clearLead([row(2 / 61, [0, 1], 1), row(2 / 62, [0, 1], 2)])).toBe(false)
  expect(clearLead([])).toBe(false)
})
