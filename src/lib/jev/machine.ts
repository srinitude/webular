// Machine-driven decisions (Stately agent shape). Jev picks the next event of
// an XState machine from the moves the machine allows.
import { Effect } from 'effect'
import {
  type AnyMachineSnapshot,
  type AnyStateMachine,
  createMachine,
  type EventObject,
  getInitialSnapshot,
} from 'xstate'
import type { JevRequest } from './client.ts'
import { defineDecision } from './define.ts'
import {
  agreedPick,
  bothOrders,
  CAPS,
  CONFIDENCE_BAR,
  canonical,
  choice,
  menu,
  noul,
  purpose,
  sureYes,
} from './payload/index.ts'

// The machine says which moves are allowed; Jev picks one of them; the machine
// takes it. The fallback is the observed event when the machine allows it.
// Mirrors allowedEvents in src/machines/agent.ts (stately-agent-on-final-port);
// import it from there once that branch lands.
export const allowedEvents = (snapshot: AnyMachineSnapshot): string[] =>
  [...new Set(snapshot._nodes.flatMap((node) => node.ownEvents))]
    .filter((type) => snapshot.can({ type }))
    .slice(0, CAPS.fields)

const MACHINE_PURPOSE = purpose(
  'A webular command runs as a state machine, one move at a time.',
  'Pick the next move that gets the command closer to its goal.',
  'A wrong move wastes a step or ends the command early.',
  'Only the listed moves are allowed from the current state; the code also saw one move happen.',
)
interface MachineInput {
  readonly machine: AnyStateMachine
  readonly snapshot: AnyMachineSnapshot
  readonly observed: EventObject
  readonly goal: string
  readonly facts?: Record<string, unknown>
}
type Allowed = MachineInput & { readonly allowed: string[] }

const observedIfAllowed = (i: MachineInput, allowed: ReadonlyArray<string>) =>
  allowed.includes(i.observed.type) ? i.observed.type : undefined

// The cache key covers the machine id, its state, the allowed events, and the
// facts, since all of them are in the canonical bytes.
const machineFacts = (i: Allowed) => ({
  goal: i.goal,
  machine: {
    id: i.machine.id,
    state: canonical(i.snapshot.value),
    allowed_events: i.allowed,
    observed_event: i.observed.type,
  },
  details: i.facts ?? {},
  context: canonical(i.snapshot.context),
})
export const machinePayload = (i: Allowed): JevRequest => ({
  state: { purpose: MACHINE_PURPOSE, facts: machineFacts(i) },
  questions: {
    // Asked in both option orders (position check); the observed event, when
    // allowed, is the default and comes first in the main order.
    ...bothOrders(
      'next',
      choice(
        'Machine `facts.machine.id` is in state `facts.machine.state`. Which event in `facts.machine.allowed_events` should it take next to reach `facts.goal`, given `facts.details`?',
        menu(observedIfAllowed(i, i.allowed) ?? i.allowed[0] ?? '', i.allowed),
      ),
    ),
    // Companion check on the move the code saw.
    observed_is_right: noul(
      'Is `facts.machine.observed_event` the right next event for machine `facts.machine.id` in state `facts.machine.state` to reach `facts.goal`, given `facts.details`?',
    ),
  },
})

const SAMPLE_MACHINE = () => {
  const machine = createMachine({
    id: 'sample',
    initial: 'idle',
    states: { idle: { on: { GO: 'done', STOP: 'done' } }, done: {} },
  })
  return { machine, snapshot: getInitialSnapshot(machine) }
}
export const nextEvent = defineDecision<Allowed, string | undefined>({
  name: 'machine.next',
  payload: machinePayload,
  sample: () => ({
    ...SAMPLE_MACHINE(),
    observed: { type: 'GO' },
    goal: 'finish the command',
    allowed: ['GO', 'STOP'],
  }),
  subtasks: [
    {
      name: 'next',
      primitive: 'choice',
      pattern: 'confidence-routing',
      payload: { question: 'next' },
    },
    {
      name: 'observed_is_right',
      primitive: 'noul',
      pattern: 'confidence-routing',
      payload: { question: 'observed_is_right' },
    },
  ],
  // Act on Jev's pick only when both orders agree at the bar and the pick is
  // allowed. A pick that overrides the observed event also needs the companion
  // to be unsure or say no about the observed one; else the observed event stands.
  read: (a, t, i) => {
    const observed = observedIfAllowed(i, i.allowed)
    const p = agreedPick(a, 'next', t)
    if (p === undefined || !i.allowed.includes(p)) return observed
    return p !== observed && observed !== undefined && sureYes(a['observed_is_right'], t) === true
      ? observed
      : p
  },
  bar: CONFIDENCE_BAR,
  fallback: (i) => observedIfAllowed(i, i.allowed),
  // The machine takes only a move it allows.
  codeCheck: (type, i) => type === undefined || i.allowed.includes(type),
  evals: 'tests/jev/evals/machine.next.json',
  docs: '88a6a003018eaea50167565a766a0d4a91d039cf93cc7dc2965d3ceba3a72caf',
})

// The chosen event is always one the machine allows from `snapshot`, or
// undefined when Jev gives no allowed pick and the observed event is not allowed.
export const machineDecision = (i: MachineInput) => {
  const allowed = allowedEvents(i.snapshot)
  return allowed.length < 2
    ? Effect.succeed(observedIfAllowed(i, allowed))
    : nextEvent({ ...i, allowed })
}
