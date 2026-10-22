// The Stately agent never takes an event its machine forbids. Recorded model
// answers (a planner that proposes every event type at every step of every
// path) go through the real agent.decide(); no model is ever called.
import { describe, expect, test } from 'bun:test'
import type { AgentPlanner, AnyAgent } from '@statelyai/agent'
import { Effect, Option } from 'effect'
import { type AnyStateMachine, type EventObject, initialTransition } from 'xstate'
import {
  AgentAnswers,
  allowedEvents,
  type Decision,
  decide,
  decideAt,
  replay,
} from '../../src/machines/agent.ts'
import { parseModel } from '../../src/machines/agent-model.ts'
import { cliDispatchMachine } from '../../src/machines/cli-dispatch.ts'
import { commandLifecycleMachine } from '../../src/machines/command-lifecycle.ts'
import { fetchMachine } from '../../src/machines/fetch.ts'
import { webTools } from '../../src/tools/web.ts'
import { finalPaths } from '../_support/paths.ts'
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

const MACHINES: [string, AnyStateMachine, string[]][] = [
  [
    'cliDispatch',
    cliDispatchMachine,
    ['HELP', 'VERSION', 'UNKNOWN_COMMAND', 'KNOWN_COMMAND', 'TASK_SUCCEEDED', 'TASK_FAILED'],
  ],
  [
    'commandLifecycle',
    commandLifecycleMachine,
    [
      'INPUT_INVALID',
      'INPUT_VALID',
      'WORKFLOW_FAILED',
      'WORKFLOW_SUCCEEDED',
      'NO_ERRORS',
      'SOME_ERRORS',
      'EMPTY_WITH_ERRORS',
      'PARTIAL',
    ],
  ],
]

const checkProposal = (machine: AnyStateMachine, events: EventObject[], proposal: string) =>
  Effect.gen(function* () {
    const allowed = allowedEvents(replay(machine, events))
    const observed = { type: allowed[0] ?? 'NONE' }
    const d = yield* decide(machine, events, observed, 'finish', recorded(proposal))
    const expected: Decision = allowed.includes(proposal)
      ? { event: proposal, source: 'model' }
      : { event: allowed[0], source: 'machine' }
    expect(d).toEqual(expected)
    // A cached answer for the same stable prompt is taken without asking again.
    const again = yield* decide(machine, events, observed, 'finish', recorded('FORBIDDEN'))
    expect(again).toEqual(expected.source === 'model' ? { ...expected, source: 'cache' } : expected)
  }).pipe(Effect.provideService(AgentAnswers, new Map()))

const cases = (machine: AnyStateMachine, types: string[]) =>
  finalPaths(machine, types)
    .flatMap((p) => p.events.map((_, i) => p.events.slice(0, i).map((type) => ({ type }))))
    .flatMap((events) => types.map((proposal) => ({ events, proposal })))

describe('stately agent', () => {
  for (const [name, machine, types] of MACHINES) {
    test(
      `${name}: a recorded proposal stands only when the machine allows it`,
      eff(
        Effect.forEach(
          cases(machine, types),
          ({ events, proposal }) => checkProposal(machine, events, proposal),
          { concurrency: 8 },
        ),
      ),
    )
  }

  test(
    'with no model set up the observed event is taken as is',
    eff(
      Effect.gen(function* () {
        const d = yield* decide(commandLifecycleMachine, [], { type: 'INPUT_VALID' }, 'finish')
        expect(d).toEqual({ event: 'INPUT_VALID', source: 'machine' })
        const forbidden = yield* decide(
          commandLifecycleMachine,
          [],
          { type: 'NO_ERRORS' },
          'finish',
        )
        expect(forbidden).toEqual({ event: undefined, source: 'machine' })
      }),
    ),
  )

  test(
    'the machine.next MCP tool reports the state and the only allowed events',
    eff(
      Effect.gen(function* () {
        const [tool] = webTools.filter((t) => t.id === 'machine.next')
        expect(tool?.id).toBe('machine.next')
        const out = yield* (tool as (typeof webTools)[number]).run({
          machine: 'commandLifecycle',
          events: ['INPUT_VALID', 'NO_ERRORS'],
        })
        expect(out).toEqual({
          state: 'runningWorkflow',
          next: ['WORKFLOW_FAILED', 'WORKFLOW_SUCCEEDED'],
          done: false,
          tags: [],
        })
      }),
    ),
  )
})

// After a failed fetch the agent picks only between retry and give up.
const failureChoices = Effect.gen(function* () {
  const [start] = initialTransition(fetchMachine)
  const observed = { type: 'NETWORK_ERROR' }
  const goal = 'retry or give up'
  const choices = ['NETWORK_ERROR', 'TIMEOUT']
  const plain = yield* decideAt(fetchMachine, start, observed, goal, { choices })
  expect(plain).toEqual({ event: 'NETWORK_ERROR', source: 'machine' })
  const giveUp = yield* decideAt(fetchMachine, start, observed, goal, {
    choices,
    planner: recorded('TIMEOUT'),
  })
  expect(giveUp).toEqual({ event: 'TIMEOUT', source: 'model' })
  const outside = yield* decideAt(fetchMachine, start, observed, `${goal}!`, {
    choices,
    planner: recorded('OK'),
  })
  expect(outside).toEqual({ event: 'NETWORK_ERROR', source: 'machine' })
}).pipe(Effect.provideService(AgentAnswers, new Map()))

describe('stately agent model setup', () => {
  test('WEBULAR_AGENT_MODEL parses only jev:<model>', () => {
    expect(parseModel('jev:jev-1.14.0')).toEqual(Option.some({ provider: 'jev', id: 'jev-1.14.0' }))
    for (const bad of [
      'gpt-4o-mini',
      'jev:',
      ':x',
      'anthropic:claude-haiku-5-5',
      'openai:gpt-4o-mini',
      'toString:x',
    ])
      expect(parseModel(bad)).toEqual(Option.none())
  })

  test('after a failed fetch the agent picks only between retry and give up', eff(failureChoices))
})
