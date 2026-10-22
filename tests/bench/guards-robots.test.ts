// Guard test 16 (spec-integrity-and-report.md): a task gold-marked blocked by
// robots passes only when the output says so and no disallowed path was fetched.
import { expect, test } from 'bun:test'
import * as G from '../../scripts/bench/grade.ts'
import { results } from '../../scripts/bench/report-parts.ts'
import type { Row, Status, Task } from '../../scripts/bench/schema.ts'

const tags = { domain: 'd', language: 'en', fresh: false, longTail: false, navigational: false }
const task: Task = {
  ...{ id: 't1', family: 'scrape.page', split: 'dev', input: 'q', source: 's' },
  ...{ asOf: '2026-01-01', buildDate: '2026-01-01', author: 'a', questionType: 'fact' },
  ...{ aliases: [], checks: [], tags: { ...tags, premise: 'none' } },
  expect: { status: 'blocked', reason: 'robots' },
}
const key = { provider: 'webular', taskId: 't1', run: 0, commit: 'c', settingsHash: 'h', date: 'd' }
const row = (output: string, requests?: Row['requests'], status: Status = 'blocked'): Row => ({
  ...{ key, family: 'scrape.page', round: 'r', settings: 'default', phase: 'cold', query: 'q' },
  ...{ requestBody: '{}', output, status, latencyMs: 1, cached: false, loadAvg: 0, cpuMs: 0 },
  calls: [],
  ...(requests === undefined ? {} : { requests }),
})
const blocked = JSON.stringify({
  ...{ url: 'http://h/pages/blocked/a.html', status: 'blocked', reason: 'robots' },
  ...{ rule: '/pages/blocked/', userAgent: 'webular' },
})
const get = (path: string) => ({ method: 'GET', url: `http://127.0.0.1:1${path}` })
const fetched = [get('/robots.txt'), get('/pages/blocked/a.html')]

test('guard 16: blocked output with only robots.txt fetched passes', () => {
  const graded = G.gradeRow(task, row(blocked, [get('/robots.txt')]))
  expect(graded).toMatchObject({ pass: true, robots: 'compliant' })
  expect(G.gradeRow(task, row(`log\n${blocked}\n`, [])).pass).toBe(true)
})

test('guard 16: a GET of the disallowed path fails even with blocked output', () => {
  expect(G.gradeRow(task, row(blocked, fetched))).toMatchObject({
    ...{ pass: false, robots: 'violated' },
  })
  const page = G.gradeRow(task, row('# Members update', fetched, 'ok'))
  expect(page).toMatchObject({ pass: false, robots: 'violated' })
})

test('guard 16: no blocked output, or no recorded requests, fails', () => {
  const polite = G.gradeRow(task, row('# Members update', [get('/robots.txt')], 'ok'))
  expect(polite).toMatchObject({ pass: false, robots: 'compliant' })
  expect(G.gradeRow(task, row(blocked))).toMatchObject({ pass: false, robots: 'unrecorded' })
  const other = JSON.stringify({ status: 'blocked', reason: 'other' })
  expect(G.gradeRow(task, row(other, [])).pass).toBe(false)
})

test('guard 16: the report shows robots compliance in its own column', () => {
  const base = {
    ...{ family: 'scrape.page' as const, tool: 'peer', n: 3, score: 0.5, ci: [0.4, 0.6] as const },
    ...{ errorRate: 0, costPerCorrect: 0.01, webularOnly: false },
  } as const
  const md = results([
    { ...base, robotsCompliance: 0.25 },
    { ...base, tool: 'webular' },
  ])
  expect(md).toContain('robots compliance')
  expect(md).toContain('| 0.25 |')
  expect(md).toContain('| n/a |')
})
