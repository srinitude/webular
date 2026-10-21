// Stately agent over webular's machines (@statelyai/agent). The agent observes
// a machine's state and picks its next event, and only an event the machine
// allows from that state can ever be taken.
// With no model set up, the agent takes the event the code observed whenever
// the machine allows it, so every command replays its machine exactly.
// With a model set up (./agent-model.ts), agent.decide() proposes an event; a
// proposal outside the allowed set, a failure, or a timeout falls back to the
// observed event. The package and the AI SDK load lazily, only on that path,
// so plain commands never pay their import cost.
import { Context, Effect, Option } from 'effect'
import {
  type AnyMachineSnapshot,
  type AnyStateMachine,
  createActor,
  type EventObject,
} from 'xstate'
import type { JevAsk } from './agent-jev.ts'
import { load, loadModel, type ModelRef, modelRef } from './agent-model.ts'

// The event types the machine accepts from this snapshot. The one place that
// reads XState's private `_nodes`: an XState upgrade that moves it breaks here only.
export const allowedEvents = (snapshot: AnyMachineSnapshot): string[] =>
  [...new Set(snapshot._nodes.flatMap((node) => node.ownEvents))].filter((type) =>
    snapshot.can({ type }),
  )

// Replays observed events, taking only those the machine allows.
export function replay(machine: AnyStateMachine, events: EventObject[]): AnyMachineSnapshot {
  const actor = createActor(machine).start()
  for (const event of events) if (actor.getSnapshot().can(event)) actor.send(event)
  const snapshot = actor.getSnapshot()
  actor.stop()
  return snapshot
}

export interface Decision {
  event: string | undefined
  source: 'machine' | 'model' | 'cache'
}

// A planner stands in for the model: tests pass recorded answers through it.
type Planner = NonNullable<import('@statelyai/agent').AgentDecideOptions['planner']>

const DECIDE_LIMITS = {
  maxTokens: 64,
  maxRetries: 1,
  timeoutMs: 5_000,
  cached: 256,
} as const

// Answers keyed by the stable prompt (machine, goal, state, context, allowed events),
// in least-used-first order: a hit moves its key to the back, a full cache drops the front.
export const AgentAnswers = Context.Reference<Map<string, string>>('webular/AgentAnswers', {
  defaultValue: () => new Map(),
})

interface Ask {
  machine: AnyStateMachine
  snapshot: AnyMachineSnapshot
  allowed: string[]
  goal: string
  planner: Planner | undefined
  jev: JevAsk | undefined
  model: ModelRef | undefined
}

interface Usage {
  promptTokens?: number
  completionTokens?: number
}

// The agent, zod, and the provider load only on the model path.
const buildAgent = (ask: Ask) =>
  Effect.map(
    Effect.all(
      [load(() => import('@statelyai/agent')), load(() => import('zod')), loadModel(ask.model)],
      { concurrency: 3 },
    ),
    ([{ createAgent }, { z }, model]) =>
      createAgent({
        name: 'webular',
        events: Object.fromEntries(ask.allowed.map((type) => [type, z.object({})])),
        model: model as never,
        maxTokens: DECIDE_LIMITS.maxTokens,
        maxRetries: DECIDE_LIMITS.maxRetries,
      }),
  )

// Logs the token usage the provider reports for each model reply.
const logUsage = (ask: Ask, usage: Usage[]) =>
  Effect.forEach(
    usage,
    (u) =>
      Effect.logInfo('agent.decide usage').pipe(
        Effect.annotateLogs({
          model: `${ask.model?.provider}:${ask.model?.id}`,
          promptTokens: u.promptTokens,
          completionTokens: u.completionTokens,
        }),
      ),
    { concurrency: 1, discard: true },
  )

// Jev picks first; the agent then takes that pick through its planner option.
const jevPlanner = (ask: Ask, jev: JevAsk) =>
  Effect.gen(function* () {
    const { jevChoose, pickedPlanner } = yield* load(() => import('./agent-jev.ts'))
    const pick = yield* jevChoose(jev, ask.snapshot, ask.allowed, ask.goal)
    return pick === undefined ? undefined : pickedPlanner(pick)
  })

const proposeEvent = (ask: Ask) =>
  Effect.gen(function* () {
    const planner = ask.jev ? yield* jevPlanner(ask, ask.jev) : ask.planner
    if (ask.jev && !planner) return undefined
    const agent = yield* buildAgent(ask)
    const usage: Usage[] = []
    agent.onMessage((message) => {
      const reported = (message as { result?: { usage?: Usage } }).result?.usage
      if (reported) usage.push(reported)
    })
    const plan = yield* Effect.tryPromise({
      try: (signal) =>
        agent.decide({
          goal: ask.goal,
          machine: ask.machine,
          state: { value: ask.snapshot.value, context: ask.snapshot.context },
          abortSignal: signal,
          ...(planner ? { planner } : {}),
        }),
      catch: (cause) => cause,
    })
    yield* logUsage(ask, usage)
    return plan?.nextEvent?.type
  }).pipe(
    Effect.timeoutOrElse({
      duration: DECIDE_LIMITS.timeoutMs,
      orElse: () => Effect.succeed(undefined),
    }),
  )

const askModel = (ask: Ask, fallback: Decision) =>
  Effect.gen(function* () {
    const answers = yield* AgentAnswers
    const { machine, goal, snapshot, allowed } = ask
    const key = JSON.stringify([machine.id, goal, snapshot.value, snapshot.context, allowed])
    const cached = answers.get(key)
    if (cached) {
      answers.delete(key)
      answers.set(key, cached)
      return { event: cached, source: 'cache' } satisfies Decision
    }
    const type = yield* proposeEvent(ask)
    if (!type || !allowed.includes(type)) return fallback
    if (answers.size >= DECIDE_LIMITS.cached) answers.delete(answers.keys().next().value ?? key)
    answers.set(key, type)
    return { event: type, source: 'model' } satisfies Decision
  }).pipe(Effect.orElseSucceed(() => fallback))

// Picks the next event from `snapshot`, given the event the code observed.
// `choices` narrows the allowed events to the ones the caller can act on.
export const decideAt = (
  machine: AnyStateMachine,
  snapshot: AnyMachineSnapshot,
  observed: EventObject,
  goal: string,
  options: { planner?: Planner; choices?: readonly string[]; jev?: JevAsk } = {},
): Effect.Effect<Decision> =>
  Effect.gen(function* () {
    const { planner, choices } = options
    const allowed = allowedEvents(snapshot).filter((type) => !choices || choices.includes(type))
    const event = allowed.includes(observed.type) ? observed.type : undefined
    const fallback: Decision = { event, source: 'machine' }
    if (allowed.length < 2 && !planner && !options.jev) return fallback
    const ref = Option.getOrUndefined(yield* modelRef)
    const jev = options.jev ?? (ref?.provider === 'jev' ? yield* liveJev(ref.id) : undefined)
    const model = ref?.provider === 'jev' ? undefined : ref
    if (!planner && !jev && !model) return fallback
    return yield* askModel({ machine, snapshot, allowed, goal, planner, jev, model }, fallback)
  })

// WEBULAR_AGENT_MODEL=jev:<model> asks the live Jev API; the client loads only then.
const liveJev = (model: string) =>
  Effect.gen(function* () {
    const { liveJevAsk } = yield* load(() => import('./agent-jev.ts'))
    return liveJevAsk(model)
  }).pipe(Effect.orElseSucceed((): JevAsk | undefined => undefined))

// Picks the next event after `events`, given the event the code observed.
export const decide = (
  machine: AnyStateMachine,
  events: EventObject[],
  observed: EventObject,
  goal: string,
  planner?: Planner,
): Effect.Effect<Decision> =>
  decideAt(machine, replay(machine, events), observed, goal, planner ? { planner } : {})
