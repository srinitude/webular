// The rescore drops the problems the stored rules wrongly raised and keeps the real ones.
import { expect, test } from 'bun:test'
import { pickModelsRun } from '../../scripts/bench/peers/matrix.ts'
import { rescoreRow } from '../../scripts/bench/rescore.ts'

const row = (over: object) => ({
  surface: 'mcp' as const,
  provider: 'webular-jev-off',
  pass: false,
  skipped: false,
  problems: [] as string[],
  toolCalls: [{ name: 'mcp__webular__search', input: {} }],
  ...over,
})
const NEVER = 'never called answer on the mcp surface'
const MATCH = 'reply does not match /gabiley district/'

test('a webular row that used any webular tool and matches ignoring case passes', () => {
  const r = rescoreRow(row({ problems: [NEVER, MATCH] }), 'It is Gabiley District.')
  expect(r.pass).toBe(true)
  expect(r.problems).toEqual([])
  expect(r.miss).toBeNull()
})

test('misses keep their label: never-called, wrong-answer, timeout', () => {
  expect(rescoreRow(row({ problems: [NEVER], toolCalls: [] }), '').miss).toBe('never-called')
  expect(rescoreRow(row({ problems: [MATCH] }), 'Baku').miss).toBe('wrong-answer')
  expect(rescoreRow(row({ problems: ['timed out'] }), '').miss).toBe('timeout')
})

test('a rival row keeps its never-called problem', () => {
  const peer = row({
    surface: 'peer',
    provider: 'exa',
    problems: ['never called a exa tool on the peer surface'],
    toolCalls: [],
  })
  expect(rescoreRow(peer, '').miss).toBe('never-called')
})

test('the merged run name is picked as the newest', () => {
  const names = ['models-2026-10-22-015700-1.json', 'models-2026-10-22-062000-merged.json']
  expect(pickModelsRun(names)).toBe('models-2026-10-22-062000-merged.json')
})
