// Contract for the summarize job: the Exa adapter's request shape and Output,
// and the key-fact recall grade (every gold fact must survive the summary).
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { answerAccuracy } from '../../scripts/bench/peers/grade.ts'
import { exaSummarize, summarized } from '../../scripts/bench/peers/summarize-jobs.ts'
import { summarizeTasks } from '../../scripts/bench/peers/summarize-tasks.ts'
import { recorded } from './replay.ts'

const task = summarizeTasks.find((t) => t.id === 'summarize-fixture-article')

test('exa summarize posts urls with summary and returns the summary text', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { post, seen } = recorded({
        results: [{ url: 'u', summary: 'Tides reach 16 metres.' }],
      })
      const call = exaSummarize(post, 'k').summarize
      const o = yield* call ? call({ url: 'https://example.com/' }) : Effect.die('no summarize')
      expect(seen[0]?.url).toBe('https://api.exa.ai/contents')
      expect(seen[0]?.headers).toEqual({ 'x-api-key': 'k' })
      expect(seen[0]?.body).toEqual({ urls: ['https://example.com/'], summary: true })
      expect(o.text).toBe('Tides reach 16 metres.')
      expect(o.costUsd).toBe(0.001)
    }),
  ))

test('a summarize task passes only when the summary keeps every gold fact', () => {
  expect(task).toBeDefined()
  if (!task) return
  const all = 'Up to 16 metres, tested since 2009, moving 100 billion tonnes.'
  expect(answerAccuracy(task, summarized(all, 'u', 0, 0))).toBe(1)
  expect(answerAccuracy(task, summarized('Up to 16 metres since 2009.', 'u', 0, 0))).toBe(0)
})

test('summarize tasks: one webular-only fixture task and one public https page', () => {
  expect(summarizeTasks.map((t) => [t.job, t.localOnly === true])).toEqual([
    ['summarize', true],
    ['summarize', false],
  ])
  expect(summarizeTasks[1]?.input.url?.startsWith('https://')).toBe(true)
})
