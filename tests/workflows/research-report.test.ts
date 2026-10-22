// Research report helpers: near-duplicate sentences drop, number conflicts and
// failed sources surface in a "## Gaps" section.
import { expect, test } from 'bun:test'
import {
  coverageLedger,
  dedupeSentences,
  findConflicts,
  gapsSection,
} from '../../src/workflows/research-report.ts'

test('a repeated sentence appears only under the first source that said it', () => {
  const out = dedupeSentences([
    ['The model scored 91 percent.', 'It runs fast.'],
    ['the model scored 91 percent', 'It was trained in 2024.'],
  ])
  expect(out).toEqual([
    ['The model scored 91 percent.', 'It runs fast.'],
    ['It was trained in 2024.'],
  ])
})

test('two sources that give different numbers for the same claim conflict', () => {
  const found = findConflicts([
    ['The model scored 91 percent on the test.'],
    ['The model scored 85 percent on the test.'],
    ['Unrelated words here 91.'],
  ])
  expect(found).toHaveLength(1)
  expect(found[0]).toMatchObject({ sourceA: 0, sourceB: 1 })
})

test('the same numbers never conflict, and conflicts stop at five', () => {
  expect(findConflicts([['It scored 91 percent.'], ['It scored 91 percent.']])).toEqual([])
  const many = Array.from({ length: 12 }, (_, i) => [`The model scored ${i} percent on the test.`])
  expect(findConflicts(many).length).toBe(5)
})

test('the ledger marks answered, failed, and no-evidence sources', () => {
  const ledger = coverageLedger(
    [{ url: 'a' }, { url: 'b' }, { url: 'c' }],
    [{ url: 'a' }],
    [{ url: 'b', reason: 'timeout' }],
  )
  expect(ledger).toEqual([
    { url: 'a', status: 'answered' },
    { url: 'b', status: 'failed', reason: 'timeout' },
    { url: 'c', status: 'no-evidence' },
  ])
})

test('the gaps section is empty when all is well and lists problems otherwise', () => {
  expect(gapsSection([{ url: 'a', status: 'answered' }], [])).toBe('')
  const text = gapsSection(
    [
      { url: 'a', status: 'answered' },
      { url: 'b', status: 'failed', reason: 'timeout' },
    ],
    [{ sourceA: 0, sourceB: 1, sentenceA: 'x 1', sentenceB: 'x 2' }],
  )
  expect(text).toContain('## Gaps')
  expect(text).toContain('b')
  expect(text).toContain('[1] vs [2]')
})
