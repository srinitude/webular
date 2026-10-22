// Contract for per-family paired scoring, the shared-tasks headline, and
// failure-inclusive latency in the peer benchmark.
import { expect, test } from 'bun:test'
import {
  familyComparisons,
  pairsFor,
  renderFamilies,
  sharedHeadline,
} from '../../scripts/bench/peers/family.ts'
import type { Job, RunRecord } from '../../scripts/bench/peers/model.ts'
import { CALL_TIMEOUT_MS, censoredLatencies } from '../../scripts/bench/peers/timeout.ts'

const row = (
  provider: string,
  task: string,
  job: Job,
  accuracy: number,
  status: RunRecord['status'] = 'ok',
): RunRecord => ({ provider, task, job, run: 1, status, metrics: { accuracy, latencyMs: 100 } })

// webular answers every search and answer task; peer offers search only and
// skips s3, so only s1 and s2 are fair ground.
const records: RunRecord[] = [
  row('webular', 's1', 'search', 1),
  row('webular', 's2', 'search', 1),
  row('webular', 's3', 'search', 1),
  row('webular', 'a1', 'answer', 1),
  row('peer', 's1', 'search', 0, 'error'),
  row('peer', 's2', 'search', 1),
  row('peer', 's3', 'search', 0, 'skipped'),
  row('peer', 'a1', 'answer', 0, 'unsupported'),
]

test('pairs use only tasks both arms scored, in task order', () => {
  expect(pairsFor(records, 'peer', 'search')).toEqual([
    { a: 1, b: 0, errA: false, errB: true },
    { a: 1, b: 1, errA: false, errB: false },
  ])
  expect(pairsFor(records, 'peer', 'answer')).toEqual([])
})

test('each family gets a paired test; an unoffered family is not offered', () => {
  const cs = familyComparisons(records, ['peer'])
  const search = cs.find((c) => c.family.startsWith('search'))
  expect(search).toMatchObject({ n: 2, diff: 0.5, test: 'exact McNemar', p: 1 })
  expect(search?.verdict).toBe('not enough tasks')
  expect(cs.find((c) => c.family.startsWith('answer'))?.verdict).toBe('not offered')
})

test('repeated runs average per task and switch to the permutation test', () => {
  const twice = [...records, { ...row('peer', 's2', 'search', 0), run: 2 }]
  const search = familyComparisons(twice, ['peer']).find((c) => c.family.startsWith('search'))
  expect(search?.test).toBe('paired permutation')
  expect(search?.diff).toBe(0.75)
})

test('each family headline compares arms only on tasks every offering arm scored', () => {
  expect(sharedHeadline(records, ['webular', 'peer'], 'search')).toEqual({
    job: 'search',
    n: 2,
    accuracy: { webular: 1, peer: 0.5 },
  })
  expect(sharedHeadline(records, ['webular', 'peer'], 'answer')).toEqual({
    job: 'answer',
    n: 1,
    accuracy: { webular: 1 },
  })
  expect(renderFamilies(records, ['peer'])).toContain(
    'search on the 2 tasks every arm offering it scored: webular 1, peer 0.5',
  )
})

test('failed rows enter latency censored at the 60 s timeout', () => {
  expect(CALL_TIMEOUT_MS).toBe(60_000)
  expect(censoredLatencies(records.filter((r) => r.provider === 'peer'))).toEqual([
    CALL_TIMEOUT_MS,
    100,
  ])
})
