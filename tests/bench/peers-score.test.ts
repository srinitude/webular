// Contract for the peer benchmark scoring: exact checks, per-provider
// summaries over shared tasks, per-dimension winners, and webular's gap.
import { expect, test } from 'bun:test'
import {
  builtinMetrics,
  type Provider,
  type RunRecord,
  type Task,
} from '../../scripts/bench/peers/model.ts'
import {
  checkPasses,
  dimensionWinners,
  percentile,
  recordMetrics,
  sharedTasks,
  summarize,
  verdicts,
} from '../../scripts/bench/peers/score.ts'

const task: Task = {
  id: 'qa',
  job: 'answer',
  suite: 'qa',
  input: { query: 'q' },
  checks: [{ kind: 'contains', values: ['Wurzburg'] }],
  answers: ['Wurzburg'],
}
const out = (text: string, latencyMs: number, costUsd: number) => ({
  text,
  urls: ['https://x.test/a'],
  citations: [
    { url: 'https://x.test/a', text: 'born in Würzburg' },
    { url: 'https://x.test/b', text: 'other' },
  ],
  costUsd,
  sentBytes: 10,
  latencyMs,
  attempts: 1,
})
const prov = (id: string, local: boolean): Provider => ({
  id,
  local,
  keyNames: local ? [] : ['k'],
  jobs: {},
})
const rec = (
  provider: string,
  run: number,
  text: string,
  latencyMs: number,
  cost: number,
): RunRecord => ({
  provider,
  task: 'qa',
  job: 'answer',
  run,
  status: 'ok',
  outputHash: text,
  metrics: recordMetrics(task, out(text, latencyMs, cost), []),
})

test('checks fold accents and case; excludes and urlMatches work', () => {
  expect(
    checkPasses({ kind: 'contains', values: ['wurzburg'] }, { text: 'WÜRZBURG', urls: [] }),
  ).toBe(true)
  expect(
    checkPasses({ kind: 'excludes', values: ['cookie'] }, { text: 'Cookies here', urls: [] }),
  ).toBe(false)
  expect(
    checkPasses(
      { kind: 'urlMatches', values: ['x\\.test'] },
      { text: '', urls: ['https://x.test'] },
    ),
  ).toBe(true)
})

test('citation precision counts cited text that supports an answer alias', () => {
  expect(recordMetrics(task, out('Würzburg', 5, 0), [])['citationPrecision']).toBe(0.5)
})

test('percentile is nearest-rank', () => {
  expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3)
  expect(percentile([5, 1, 3, 2, 4], 99)).toBe(5)
})

test('summary, winners, and webular gap in metric units', () => {
  const records = [
    rec('webular', 1, 'Wurzburg', 100, 0),
    rec('webular', 2, 'Wurzburg', 300, 0),
    rec('peer', 1, 'Wurzburg!', 50, 0.01),
    rec('peer', 2, 'no idea', 70, 0.01),
  ]
  const providers = [prov('webular', true), prov('peer', false)]
  const s = summarize(records, providers, builtinMetrics, sharedTasks(records, ['webular', 'peer']))
  expect(s['webular']?.['accuracy']).toBe(1)
  expect(s['peer']?.['accuracy']).toBe(0.5)
  expect(s['webular']?.['determinism']).toBe(1)
  expect(s['peer']?.['determinism']).toBe(0)
  expect(s['peer']?.['costPerCorrectUsd']).toBeCloseTo(0.02)
  const vs = verdicts(s, builtinMetrics)
  const p50 = vs.find((v) => v.metric === 'latencyP50Ms')
  expect(p50?.best).toBe('peer')
  expect(p50?.gap).toBe(50)
  expect(vs.find((v) => v.metric === 'accuracy')?.gap).toBe(0)
  const wins = dimensionWinners(vs)
  expect(wins['speed']).toBe('peer')
  expect(wins['control']).toBe('webular')
  expect(wins['quality']).toBe('webular')
})

test('a plan metric is one registry entry, scored with no new plumbing', () => {
  const def = {
    name: 'mentionsBavaria',
    dimension: 'grounding',
    better: 'higher' as const,
    unit: 'share',
    check: { kind: 'contains' as const, values: ['Bavaria'] },
  }
  const r: RunRecord = {
    ...rec('webular', 1, 'x', 1, 0),
    metrics: recordMetrics(task, out('Würzburg, Bavaria', 1, 0), [def]),
  }
  const s = summarize([r], [prov('webular', true)], [...builtinMetrics, def])
  expect(s['webular']?.['mentionsBavaria']).toBe(1)
  expect(dimensionWinners(verdicts(s, [def]))['grounding']).toBe('webular')
})
