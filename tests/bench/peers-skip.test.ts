// Contract: a robots-gold task (fixture path the fixture robots.txt disallows)
// is unsupported for a peer that cannot expose its target-site requests, and
// that row is never scored.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import {
  builtinMetrics,
  type Provider,
  type RunRecord,
  type Task,
} from '../../scripts/bench/peers/model.ts'
import { summarize } from '../../scripts/bench/peers/score.ts'
import { skipReason } from '../../scripts/bench/peers/skip.ts'

const out = { text: '', urls: [], citations: [], costUsd: 0, sentBytes: 0 }
const hosted: Provider = {
  ...{ id: 'firecrawl', local: false, keyNames: [] },
  jobs: { scrape: () => Effect.succeed(out) },
}
const task = (url: string): Task => ({
  ...{ id: 'robots', job: 'scrape', suite: 'robots', checks: [], localOnly: true },
  input: { url },
})

test('a hosted peer gets unsupported, with the reason, on a robots-gold task', () => {
  const why = skipReason(hosted, task('{fixture}/pages/blocked/a.html'))
  expect(why).toEqual(['unsupported', 'peer does not expose its target-site requests'])
  const [status, note] = why ?? ['ok', '']
  const row: RunRecord = {
    ...{ provider: 'firecrawl', task: 'robots', job: 'scrape', run: 1 },
    ...{ status, note, metrics: {} },
  }
  expect(summarize([row], [hosted], builtinMetrics)).toEqual({})
})

test('an allowed fixture path and an outside URL keep their old reasons', () => {
  expect(skipReason(hosted, task('{fixture}/article'))?.[1]).toBe(
    'local fixture unreachable from a hosted API',
  )
  expect(skipReason(hosted, { ...task('https://x.test/pages/blocked/a'), localOnly: false })).toBe(
    undefined,
  )
})
