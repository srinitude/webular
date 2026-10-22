// Peers waiting on the user's approval run no job and say why.
import { expect, test } from 'bun:test'
import { awaitingApproval } from '../../scripts/bench/peers/awaiting-approval.ts'

test('every peer awaiting approval has no jobs and an awaiting-approval skip', () => {
  expect(awaitingApproval.map((p) => p.id)).toEqual([
    'openai-web-search',
    'anthropic-web',
    'vertex-grounding',
    'bing-grounding',
    'zyte',
    'brave',
    'spider',
  ])
  for (const p of awaitingApproval) {
    expect(p.jobs).toEqual({})
    expect(p.skip).toStartWith('awaiting approval: ')
  }
})

test('brave is skipped with the closed-free-plan reason and keeps its row', () => {
  const brave = awaitingApproval.find((p) => p.id === 'brave')
  expect(brave?.skip).toBe('awaiting approval: the free plan is closed to new users')
  expect(brave?.jobs).toEqual({})
})
