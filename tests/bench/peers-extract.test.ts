// Contract for the extract job: the Firecrawl adapter's request shape and
// Output, and the grade an extract task gives (gold value in the JSON text).
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { extracted, firecrawlExtract } from '../../scripts/bench/peers/extract-jobs.ts'
import { extractSpecs, extractTasks } from '../../scripts/bench/peers/extract-tasks.ts'
import { answerAccuracy } from '../../scripts/bench/peers/grade.ts'
import { recorded } from './replay.ts'

test('firecrawl extract posts a json format with a schema and returns the JSON as text', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { post, seen } = recorded({
        success: true,
        data: { json: { title: 'Example Domain' } },
      })
      const call = firecrawlExtract(post, 'k').extract
      const o = yield* call ? call({ url: 'https://example.com/' }) : Effect.die('no extract')
      expect(seen[0]?.url).toBe('https://api.firecrawl.dev/v2/scrape')
      expect(seen[0]?.headers).toEqual({ authorization: 'Bearer k' })
      expect(seen[0]?.body).toEqual({
        url: 'https://example.com/',
        formats: [
          { type: 'json', schema: { type: 'object', properties: { title: { type: 'string' } } } },
        ],
      })
      expect(o.text).toBe('{"title":"Example Domain"}')
    }),
  ))

test('an extract task passes only when the JSON text holds the gold value', () => {
  const task = extractTasks.find((t) => t.id === 'extract-example-title')
  expect(task).toBeDefined()
  if (!task) return
  expect(answerAccuracy(task, extracted({ title: 'Example Domain' }, 'u', 0, 0))).toBe(1)
  expect(answerAccuracy(task, extracted({ title: 'Other' }, 'u', 0, 0))).toBe(0)
})

test('extract tasks are three, each on a public https page with a field spec', () => {
  expect(extractTasks.length).toBe(3)
  for (const t of extractTasks) {
    expect(t.job).toBe('extract')
    expect(t.input.url?.startsWith('https://')).toBe(true)
    expect(extractSpecs[t.input.url ?? '']).toBeDefined()
  }
})
