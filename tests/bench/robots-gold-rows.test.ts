// Guard test 16 on the real gold: each robots row in the dev scrape set grades
// pass for a compliant run (robots.txt fetched, blocked output) and fail when
// the recorded requests hold a GET of its own disallowed path.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import * as G from '../../scripts/bench/grade.ts'
import { loadSetFile } from '../../scripts/bench/loader.ts'
import type { Row, Task } from '../../scripts/bench/schema.ts'
import { eff } from '../_support/run.ts'

const DIR = `${import.meta.dir}/../../bench/tasks`
const ORIGIN = 'http://127.0.0.1:4100'
const tags = { domain: 'd', language: 'en', fresh: false, longTail: false, navigational: false }
const base: Omit<Task, 'id' | 'expect'> = {
  ...{ family: 'scrape.page', split: 'dev', input: 'q', source: 's', asOf: '2026-01-01' },
  ...{ buildDate: '2026-01-01', author: 'a', questionType: 'fact', aliases: [], checks: [] },
  tags: { ...tags, premise: 'none' },
}
const row = (id: string, output: string, requests: Row['requests']): Row => ({
  key: { provider: 'webular', taskId: id, run: 0, commit: 'c', settingsHash: 'h', date: 'd' },
  ...{ family: 'scrape.page', round: 'r', settings: 'default', phase: 'cold', query: 'q' },
  ...{ requestBody: '{}', output, status: 'blocked', latencyMs: 1, cached: false },
  ...{ loadAvg: 0, cpuMs: 0, calls: [], requests },
})
const get = (path: string) => ({ method: 'GET', url: `${ORIGIN}${path}` })

test(
  'guard 16: robots gold rows pass when compliant and fail on a planted disallowed GET',
  eff(
    Effect.gen(function* () {
      const { tasks } = yield* loadSetFile(DIR, 'dev/scrape.jsonl')
      const gold = tasks.filter((t) => t.expect !== undefined)
      expect(gold.length).toBe(3)
      for (const t of gold) {
        const path = String(t.input['path'])
        const task: Task = { ...base, id: t.id, ...(t.expect ? { expect: t.expect } : {}) }
        const blocked = JSON.stringify({ url: `${ORIGIN}${path}`, ...t.expect })
        const compliant = G.gradeRow(task, row(t.id, blocked, [get('/robots.txt')]))
        expect(compliant).toMatchObject({ pass: true, robots: 'compliant' })
        const planted = [get('/robots.txt'), get(path)]
        expect(G.gradeRow(task, row(t.id, blocked, planted))).toMatchObject({
          ...{ pass: false, robots: 'violated' },
        })
      }
    }),
  ),
)
