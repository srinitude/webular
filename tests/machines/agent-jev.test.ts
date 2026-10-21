// Jev as the agent's planner, driven by recorded Jev answers: no network call.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { initialTransition } from 'xstate'
import { AgentAnswers, allowedEvents, type Decision, decideAt } from '../../src/machines/agent.ts'
import {
  JEV_BAR,
  type JevAnswer,
  type JevAsk,
  type JevRequest,
  jevPick,
  jevRequest,
  pinnedModel,
} from '../../src/machines/agent-jev.ts'
import { fetchMachine } from '../../src/machines/fetch.ts'
import { eff } from '../_support/run.ts'

const [start] = initialTransition(fetchMachine)
const choices = ['NETWORK_ERROR', 'TIMEOUT']
const observed = { type: 'NETWORK_ERROR' }

// A recorded Jev reply; `asked` collects every request it was sent.
const recorded = (answer: JevAnswer) => {
  const asked: JevRequest[] = []
  const ask: JevAsk = (req) =>
    Effect.sync(() => {
      asked.push(req)
      return { next: answer }
    })
  return { ask, asked }
}

describe('jev planner', () => {
  test('allowedEvents lists the events the snapshot accepts', () => {
    expect(allowedEvents(start)).toEqual([
      'OK',
      'HTTP_ERROR',
      'RETRYABLE_STATUS',
      'NETWORK_ERROR',
      'TIMEOUT',
      'REDIRECT_SAME_HOST',
      'REDIRECT_OFF_HOST',
    ])
  })

  test('the Choice offers exactly the allowed events', () => {
    const req = jevRequest('retry or give up', start, choices)
    expect(Object.keys(req.questions['next']?.criteria ?? {})).toEqual(choices)
    expect(req.questions['next']?.type).toBe('choice')
  })

  test('the floating jev-latest alias is sent as the pinned version', () => {
    expect(pinnedModel('jev-latest')).toBe('jev-1.13.0')
    expect(pinnedModel('jev-1.13.0')).toBe('jev-1.13.0')
  })

  test('a pick counts only when allowed and at the bar', () => {
    expect(jevPick({ choice: 'TIMEOUT', confidence: JEV_BAR }, choices)).toBe('TIMEOUT')
    expect(jevPick({ choice: 'TIMEOUT', confidence: 0.94 }, choices)).toBeUndefined()
    expect(jevPick({ choice: 'OK', confidence: 1 }, choices)).toBeUndefined()
    expect(jevPick({ choice: 'TIMEOUT', confidence: null }, choices)).toBeUndefined()
    expect(jevPick(undefined, choices)).toBeUndefined()
  })

  test(
    'decideAt takes a confident pick, then answers from the cache',
    eff(
      Effect.gen(function* () {
        const jev = recorded({ choice: 'TIMEOUT', confidence: 0.99 })
        const goal = 'retry or give up'
        const first = yield* decideAt(fetchMachine, start, observed, goal, {
          choices,
          jev: jev.ask,
        })
        expect(first).toEqual({ event: 'TIMEOUT', source: 'model' })
        const again = yield* decideAt(fetchMachine, start, observed, goal, {
          choices,
          jev: jev.ask,
        })
        expect(again).toEqual({ event: 'TIMEOUT', source: 'cache' })
        expect(jev.asked.length).toBe(1)
      }).pipe(Effect.provideService(AgentAnswers, new Map())),
    ),
  )

  test(
    'a low-confidence or failed Jev call keeps the observed event',
    eff(
      Effect.gen(function* () {
        const low = recorded({ choice: 'TIMEOUT', confidence: 0.6 })
        const goal = 'retry or give up'
        const fallback: Decision = { event: 'NETWORK_ERROR', source: 'machine' }
        expect(
          yield* decideAt(fetchMachine, start, observed, goal, { choices, jev: low.ask }),
        ).toEqual(fallback)
        const failing: JevAsk = () => Effect.fail('jev status 529')
        expect(
          yield* decideAt(fetchMachine, start, observed, `${goal}!`, { choices, jev: failing }),
        ).toEqual(fallback)
      }).pipe(Effect.provideService(AgentAnswers, new Map())),
    ),
  )
})
