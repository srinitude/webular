// Contract for the research job: the Perplexity and Exa adapters' request shape
// and Output, the polling bound, the webular arm's wiring, and the grade a
// research task gives (the gold answer anywhere in the report).
import { expect, test } from 'bun:test'
import { Effect, Schema } from 'effect'
import { answerAccuracy } from '../../scripts/bench/peers/grade.ts'
import { fail } from '../../scripts/bench/peers/peers.ts'
import { webular } from '../../scripts/bench/peers/providers.ts'
import { exaResearch, perplexityResearch } from '../../scripts/bench/peers/research-jobs.ts'
import { researchTasks } from '../../scripts/bench/peers/research-tasks.ts'
import { recorded } from './replay.ts'

const ask = { query: 'q?' }

test('perplexity research posts input and preset to the agent endpoint and joins output text', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const message = { type: 'message', content: [{ type: 'output_text', text: 'Warsaw' }] }
      const { post, seen } = recorded({ output: [message] })
      const o = yield* perplexityResearch(post, 'k').research?.(ask) ?? Effect.die('no research')
      expect(seen[0]?.url).toBe('https://api.perplexity.ai/v1/agent')
      expect(seen[0]?.headers).toEqual({ authorization: 'Bearer k' })
      expect(seen[0]?.body).toEqual({ input: 'q?', preset: 'high' })
      expect(o.text).toBe('Warsaw')
    }),
  ))

const run = (status: string, text?: string) => ({
  id: 'r1',
  status,
  ...(text ? { output: { text } } : {}),
  costDollars: { total: 0.4 },
})

test('exa research creates a run, polls until completed, and reports its cost', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { post, seen } = recorded(run('running'))
      const polls: string[] = []
      const replies = [run('running'), run('completed', 'New Zealand')]
      const get = <A>(url: string, _h: Record<string, string>, schema: Schema.Codec<A>) => {
        polls.push(url)
        return Schema.decodeUnknownEffect(schema)(replies.shift()).pipe(Effect.mapError(fail))
      }
      const o = yield* exaResearch(post, get, 'k').research?.(ask) ?? Effect.die('no research')
      expect(seen[0]?.url).toBe('https://api.exa.ai/agent/runs')
      expect(seen[0]?.body).toEqual({ query: 'q?', effort: 'high' })
      expect(polls).toEqual(Array(2).fill('https://api.exa.ai/agent/runs/r1'))
      expect(o.text).toBe('New Zealand')
      expect(o.costUsd).toBe(0.4)
    }),
  ))

test('exa research fails a run that ends failed', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { post } = recorded(run('failed'))
      const get = () => Effect.die('no poll')
      const call = exaResearch(post, get, 'k').research?.(ask) ?? Effect.die('no research')
      expect((yield* Effect.exit(call))._tag).toBe('Failure')
    }),
  ))

test('webular provides a research job', () => {
  expect(webular.jobs.research).toBeDefined()
})

test('a research task passes when the gold answer is anywhere in the report', () => {
  const task = researchTasks[0]
  expect(task).toBeDefined()
  if (!task) return
  const report = '# Research\n\nHe studied at King’s College, Cambridge.'
  expect(answerAccuracy(task, { text: report, urls: [] })).toBe(1)
  expect(answerAccuracy(task, { text: '# Research\n\nOxford.', urls: [] })).toBe(0)
})

test('research tasks are three, each a research-suite question with aliases', () => {
  expect(researchTasks.length).toBe(3)
  for (const t of researchTasks) {
    expect([t.job, t.suite]).toEqual(['research', 'research'])
    expect(t.input.query).toBeTruthy()
    expect(t.answers?.length).toBeGreaterThan(0)
  }
})
