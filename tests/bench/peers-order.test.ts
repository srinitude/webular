// Contract: a round's arm and task order comes from one seed, and each
// webular-versus-peer timed pair runs in A,B,B,A order across runs.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { resolveSeed, schedule, webularLeads } from '../../scripts/bench/peers/order.ts'
import { eff, failMsg } from '../_support/run.ts'

const tasks = ['t1', 't2', 't3', 't4', 't5'].map((id) => ({ id }))
const providers = ['webular', 'exa', 'firecrawl', 'tavily'].map((id) => ({ id }))
const flat = (steps: readonly { run: number; task: { id: string }; provider: { id: string } }[]) =>
  steps.map((s) => `${s.run}:${s.task.id}:${s.provider.id}`)

test(
  'the same seed gives the same order, and another seed gives a different one',
  eff(
    Effect.gen(function* () {
      const a = flat(yield* schedule(7, tasks, providers, 4))
      const b = flat(yield* schedule(7, tasks, providers, 4))
      const c = flat(yield* schedule(8, tasks, providers, 4))
      expect(a).toEqual(b)
      expect(a).not.toEqual(c)
      expect(a).toHaveLength(4 * tasks.length * providers.length)
    }),
  ),
)

test(
  'webular leads then trails in an A,B,B,A cycle for every task',
  eff(
    Effect.gen(function* () {
      const steps = yield* schedule(42, tasks, providers, 4)
      for (const t of tasks) {
        const leads = [1, 2, 3, 4].map((run) => {
          const arms = steps.filter((s) => s.run === run && s.task.id === t.id)
          return arms[0]?.provider.id === 'webular'
        })
        const first = leads[0] === true
        expect(leads).toEqual([first, !first, !first, first])
      }
    }),
  ),
)

test('the cycle flips when the task coin flips', () => {
  expect([1, 2, 3, 4].map((r) => webularLeads(r, false))).toEqual([true, false, false, true])
  expect([1, 2, 3, 4].map((r) => webularLeads(r, true))).toEqual([false, true, true, false])
})

test(
  'a --seed value is used as given, and a bad one is refused',
  eff(
    Effect.gen(function* () {
      expect(yield* resolveSeed('123')).toBe(123)
      expect(yield* failMsg(resolveSeed('abc'))).toContain('--seed must be an integer')
      expect(Number.isSafeInteger(yield* resolveSeed(undefined))).toBe(true)
    }),
  ),
)
