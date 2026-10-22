// The peer set covers seven categories, every row has one gold answer that a
// literal match can check, and no gold or alias leaks into its question.
import { expect, test } from 'bun:test'
import seed from './peers-seed.json'

const CATEGORIES = [
  'factual',
  'multi-hop',
  'fresh',
  'official-site',
  'extract',
  'pdf',
  'comparison',
]

test('the peer seed spans seven categories with checkable gold', () => {
  expect(seed.length).toBeGreaterThanOrEqual(20)
  expect(new Set(seed.map((r) => r.tags.category))).toEqual(new Set(CATEGORIES))
  expect(new Set(seed.map((r) => r.id)).size).toBe(seed.length)
  for (const r of seed) {
    expect(r.gold.answers.length).toBe(1)
    expect(r.aliases).toContain(r.gold.answers[0] ?? '')
    expect(r.aliases.filter((a) => r.input.question.includes(a))).toEqual([])
    expect(r.split).toBe('dev')
    expect(r.source.license.trim()).not.toBe('')
  }
})
