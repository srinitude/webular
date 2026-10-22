// Contract for the act job: the Firecrawl adapter's request shape, a fixture
// that holds the gold text only after the click, and the grade an act task gives.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { firecrawlAct } from '../../scripts/bench/peers/act-jobs.ts'
import { actGold, actPage, actTasks } from '../../scripts/bench/peers/act-tasks.ts'
import { answerAccuracy } from '../../scripts/bench/peers/grade.ts'
import { out } from '../../scripts/bench/peers/peers.ts'
import { recorded } from './replay.ts'

test('firecrawl act posts a click and a wait before the markdown', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { post, seen } = recorded({ data: { markdown: `The code is ${actGold}` } })
      const call = firecrawlAct(post, 'k').act
      const o = yield* call ? call({ url: 'http://x/act' }) : Effect.die('no act')
      expect(seen[0]?.url).toBe('https://api.firecrawl.dev/v2/scrape')
      expect(seen[0]?.headers).toEqual({ authorization: 'Bearer k' })
      expect(seen[0]?.body).toEqual({
        url: 'http://x/act',
        formats: ['markdown'],
        actions: [
          { type: 'click', selector: '#reveal' },
          { type: 'wait', milliseconds: 500 },
        ],
      })
      expect(o.text).toContain(actGold)
    }),
  ))

test('the gold text is absent from the page source and is built only by the click handler', () => {
  expect(actPage).not.toContain(actGold)
  expect(actPage).toContain('id="reveal"')
  expect(actPage).toContain('onclick')
})

test('an act task passes only when the output holds the gold text', () => {
  const task = actTasks[0]
  expect(task?.job).toBe('act')
  if (!task) return
  expect(answerAccuracy(task, out(`The code is ${actGold}`, [], 0, 0))).toBe(1)
  expect(answerAccuracy(task, out('Reveal', [], 0, 0))).toBe(0)
})
