// Contract for the monitor job: the Firecrawl adapter's two-call request shape,
// the webular arm's shared scratch database, the fixture flip, and the grade.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { answerAccuracy } from '../../scripts/bench/peers/grade.ts'
import { firecrawlMonitor, webularMonitor } from '../../scripts/bench/peers/monitor-jobs.ts'
import { monitorRoute, monitorTasks } from '../../scripts/bench/peers/monitor-tasks.ts'
import { recorded } from './replay.ts'

const task = monitorTasks[0]

const changed = {
  success: true,
  data: { changeTracking: { changeStatus: 'changed', diff: { text: '-ten\n+twelve' } } },
}

test('firecrawl monitor scrapes twice with changeTracking git-diff and reports the second status', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { post, seen } = recorded(changed)
      const call = firecrawlMonitor(post, 'k').monitor
      const o = yield* call ? call({ url: 'http://x/monitor' }) : Effect.die('no monitor')
      expect(seen.length).toBe(2)
      for (const s of seen) {
        expect(s.url).toBe('https://api.firecrawl.dev/v2/scrape')
        expect(s.headers).toEqual({ authorization: 'Bearer k' })
        expect(s.body).toEqual({
          url: 'http://x/monitor',
          formats: [{ type: 'changeTracking', modes: ['git-diff'] }],
        })
      }
      expect(o.text).toBe('{"changeStatus":"changed","diff":"-ten\\n+twelve"}')
      expect(task && answerAccuracy(task, o)).toBe(1)
    }),
  ))

test('webular monitor runs the workflow twice on one scratch database and returns the second result', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const paths: string[] = []
      const results = [{ changeStatus: 'new' }, { changeStatus: 'changed', diff: '+twelve' }]
      const call = webularMonitor((i) =>
        Effect.sync(() => {
          paths.push(i.dbPath)
          return results[paths.length - 1] ?? { changeStatus: 'same' }
        }),
      ).monitor
      const o = yield* call ? call({ url: 'u' }) : Effect.die('no monitor')
      expect(paths.length).toBe(2)
      expect(paths[0]).toBe(paths[1])
      expect(o.text).toBe('{"changeStatus":"changed","diff":"+twelve"}')
      expect(task && answerAccuracy(task, o)).toBe(1)
    }),
  ))

test('the monitor fixture reads ten once, then twelve, and a "same" result fails the task', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const route = monitorRoute()
      expect(yield* Effect.promise(() => route().text())).toContain('ten crates')
      expect(yield* Effect.promise(() => route().text())).toContain('twelve crates')
      const same = {
        text: '{"changeStatus":"same"}',
        urls: [],
        citations: [],
        costUsd: 0,
        sentBytes: 0,
      }
      expect(task && answerAccuracy(task, same)).toBe(0)
    }),
  ))
