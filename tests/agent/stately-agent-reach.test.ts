// Proof that the Stately agent (@statelyai/agent) reaches every webular machine
// and can only take an event the machine allows from its current state.
// Every model answer is recorded: a planner or a mock language model. No live call.
import { describe, expect, test } from 'bun:test'
import { createAgent } from '@statelyai/agent'
import { MockLanguageModelV1 } from 'ai/test'
import { Effect, FileSystem } from 'effect'
import { type AnyMachineSnapshot, type AnyStateMachine, StateMachine } from 'xstate'
import { getShortestPaths } from 'xstate/graph'
import { z } from 'zod'
import { AgentAnswers, allowedEvents, decideAt, replay } from '../../src/machines/agent.ts'
import { type JevAsk, type JevRequest, pickedPlanner } from '../../src/machines/agent-jev.ts'
import { machineSchema, machineState } from '../../src/tools/web-machine.ts'
import { eff } from '../_support/run.ts'

const DIR = new URL('../../src/machines/', import.meta.url)

// Every state machine exported from src/machines, found by scanning the folder.
const allMachines = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const files = (yield* fs.readDirectory(DIR.pathname)).filter((file) => file.endsWith('.ts'))
  const mods = yield* Effect.forEach(
    files,
    (file) => Effect.tryPromise(() => import(new URL(file, DIR).href)),
    { concurrency: 8 },
  )
  return mods.flatMap((mod) =>
    Object.values(mod as object).filter((v): v is AnyStateMachine => v instanceof StateMachine),
  )
})

// One snapshot per reachable state and context, made by replaying its path.
const reachable = (machine: AnyStateMachine): AnyMachineSnapshot[] =>
  getShortestPaths(machine, { events: machine.events.map((type) => ({ type })) }).map((path) =>
    replay(
      machine,
      path.steps.slice(1).map((step) => step.event),
    ),
  )

// The machine.next tool's machine list matches the machines in src/machines.
const toolNamesEveryMachine = Effect.gen(function* () {
  const machines = yield* allMachines
  const names = machineSchema.shape.machine.options
  expect(machines.map((m) => m.id).toSorted()).toEqual([...names].toSorted())
  for (const machine of machines) {
    const out = yield* machineState(machine.id as (typeof names)[number], [])
    expect(out.next).toEqual(allowedEvents(replay(machine, [])))
  }
})

// A recorded proposal stands only when the state allows it.
const checkProposal = (machine: AnyStateMachine, snap: AnyMachineSnapshot, proposal: string) =>
  Effect.gen(function* () {
    const allowed = allowedEvents(snap)
    const observed = { type: allowed[0] ?? 'NONE' }
    const d = yield* decideAt(machine, snap, observed, 'finish', {
      planner: pickedPlanner(proposal),
    })
    expect(d.event).toBe(allowed.includes(proposal) ? proposal : allowed[0])
    if (d.event !== undefined) expect(snap.can({ type: d.event })).toBe(true)
  }).pipe(Effect.provideService(AgentAnswers, new Map()))

const sweep = (machine: AnyStateMachine) =>
  Effect.forEach(
    reachable(machine).flatMap((snap) => machine.events.map((proposal) => ({ snap, proposal }))),
    ({ snap, proposal }) => checkProposal(machine, snap, proposal),
    { concurrency: 8, discard: true },
  )

// A mock model that records the tools it was offered and calls `reply`.
const recordedModel = (offered: string[][], reply: (tools: string[]) => string) =>
  new MockLanguageModelV1({
    doGenerate: (options) =>
      Effect.runPromise(
        Effect.sync(() => {
          const tools = options.mode.type === 'regular' ? (options.mode.tools ?? []) : []
          const names = tools.map((t) => t.name)
          offered.push(names)
          const call = { toolCallType: 'function' as const, toolCallId: 'recorded', args: '{}' }
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'tool-calls' as const,
            usage: { promptTokens: 1, completionTokens: 1 },
            toolCalls: [{ ...call, toolName: reply(names) }],
          }
        }),
      ),
  })

// The package's own planner, set up as webular sets it up: only allowed events.
const decideWith = (machine: AnyStateMachine, snap: AnyMachineSnapshot, model: unknown) =>
  Effect.tryPromise(() =>
    createAgent({
      name: 'webular',
      events: Object.fromEntries(allowedEvents(snap).map((type) => [type, z.object({})])),
      model: model as never,
    }).decide({
      goal: 'finish',
      machine,
      state: { value: snap.value, context: snap.context },
    }),
  )

// The model is offered exactly the allowed events, and a forbidden reply is no plan.
const checkModelPath = (machine: AnyStateMachine, snap: AnyMachineSnapshot) =>
  Effect.gen(function* () {
    const allowed = allowedEvents(snap)
    const offered: string[][] = []
    const plan = yield* decideWith(
      machine,
      snap,
      recordedModel(offered, ([first]) => `${first}`),
    )
    expect(offered.map((names) => names.toSorted())).toEqual([allowed.toSorted()])
    expect(plan?.nextEvent?.type).toBe(offered[0]?.[0])
    const forbidden = machine.events.find((type) => !allowed.includes(type))
    if (forbidden === undefined) return
    const bad = yield* Effect.result(
      decideWith(
        machine,
        snap,
        recordedModel([], () => forbidden),
      ),
    )
    expect(bad._tag === 'Failure' || bad.success?.nextEvent === undefined).toBe(true)
  })

const modelSweep = (machine: AnyStateMachine) =>
  Effect.forEach(
    reachable(machine).filter((snap) => allowedEvents(snap).length > 0),
    (snap) => checkModelPath(machine, snap),
    { concurrency: 4, discard: true },
  )

// A recorded Jev reply that picks `choice` at `confidence`; `asked` keeps each request.
const recordedJev =
  (choice: string, confidence: number, asked: JevRequest[] = []): JevAsk =>
  (req) =>
    Effect.sync(() => {
      asked.push(req)
      return { next: { choice, confidence } }
    })

// Each decision gets its own answer cache, so no pick is served from an earlier one.
const jevDecides = (machine: AnyStateMachine, snap: AnyMachineSnapshot, jev: JevAsk) =>
  decideAt(machine, snap, { type: allowedEvents(snap)[0] ?? 'NONE' }, 'finish', { jev }).pipe(
    Effect.provideService(AgentAnswers, new Map()),
  )

// Where a judgment fits (two or more allowed events), Jev is asked over exactly the
// allowed events and its confident pick is the agent's next event; a forbidden or
// unsure pick leaves the observed event in place.
const checkJev = (machine: AnyStateMachine, snap: AnyMachineSnapshot) =>
  Effect.gen(function* () {
    const allowed = allowedEvents(snap)
    for (const pick of allowed) {
      const asked: JevRequest[] = []
      const d = yield* jevDecides(machine, snap, recordedJev(pick, 0.99, asked))
      expect(d).toEqual({ event: pick, source: 'model' })
      const offered = Object.keys(asked[0]?.questions['next']?.criteria ?? {})
      expect(offered.toSorted()).toEqual(allowed.toSorted())
    }
    const forbidden = machine.events.find((type) => !allowed.includes(type)) ?? 'NOT_AN_EVENT'
    const kept = { event: allowed[0], source: 'machine' } as const
    expect(yield* jevDecides(machine, snap, recordedJev(forbidden, 0.99))).toEqual(kept)
    expect(yield* jevDecides(machine, snap, recordedJev(`${allowed[1]}`, 0.6))).toEqual(kept)
  })

const jevSweep = (machine: AnyStateMachine) =>
  Effect.forEach(
    reachable(machine).filter((snap) => allowedEvents(snap).length > 1),
    (snap) => checkJev(machine, snap),
    { concurrency: 4, discard: true },
  )

const everyMachine = (check: (machine: AnyStateMachine) => Effect.Effect<void, unknown>) =>
  Effect.flatMap(allMachines, (ms) => Effect.forEach(ms, check, { concurrency: 1, discard: true }))

describe('stately agent reach', () => {
  test('the machine.next tool names every machine in src/machines', eff(toolNamesEveryMachine))

  test(
    'in every reachable state of every machine, a recorded proposal stands only when allowed',
    eff(everyMachine(sweep)),
  )

  test(
    'the agent offers its model only the allowed events, in every reachable state',
    eff(everyMachine(modelSweep)),
  )

  test(
    'where a judgment fits, the agent takes a confident allowed Jev pick as its next event',
    eff(everyMachine(jevSweep)),
  )
})
