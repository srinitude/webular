// The answer cache stays at its limit by dropping its oldest-used entry (LRU).
import { expect, test } from 'bun:test'
import type { AgentPlanner, AnyAgent } from '@statelyai/agent'
import { Effect } from 'effect'
import { initialTransition } from 'xstate'
import { AgentAnswers, decideAt } from '../../src/machines/agent.ts'
import { fetchMachine } from '../../src/machines/fetch.ts'
import { eff } from '../_support/run.ts'

// The planner contract is Promise-shaped; the recorded answer is an Effect run once.
const recorded =
  (type: string): AgentPlanner<AnyAgent> =>
  (_agent, input) =>
    Effect.runPromise(
      Effect.succeed({
        goal: input.goal,
        state: input.state,
        nextEvent: { type } as never,
        execute: () => Effect.runPromise(Effect.succeed(undefined)),
        sessionId: 'recorded',
        timestamp: 0,
      }),
    )

const LIMIT = 256
const [start] = initialTransition(fetchMachine)
const ask = (goal: string) =>
  decideAt(fetchMachine, start, { type: 'NETWORK_ERROR' }, goal, {
    choices: ['NETWORK_ERROR', 'TIMEOUT'],
    planner: recorded('TIMEOUT'),
  })

const lruEviction = Effect.gen(function* () {
  const answers = yield* AgentAnswers
  expect(yield* ask('kept')).toEqual({ event: 'TIMEOUT', source: 'model' })
  for (let i = 1; i < LIMIT; i++) answers.set(`filler-${i}`, 'TIMEOUT')
  // A hit moves 'kept' to the back of the order, so the first filler goes first.
  expect(yield* ask('kept')).toEqual({ event: 'TIMEOUT', source: 'cache' })
  expect(yield* ask('new')).toEqual({ event: 'TIMEOUT', source: 'model' })
  expect(answers.size).toBe(LIMIT)
  expect(answers.has('filler-1')).toBe(false)
  expect(answers.has('filler-2')).toBe(true)
  expect(yield* ask('kept')).toEqual({ event: 'TIMEOUT', source: 'cache' })
}).pipe(Effect.provideService(AgentAnswers, new Map()))

test('a full answer cache drops only its least-used entry', eff(lruEviction))
