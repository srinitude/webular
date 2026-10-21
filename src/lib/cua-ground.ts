// Cua planner/grounder split with an early infeasibility stop (paper
// 2505.13227). The planner (the caller: a model or a script) emits semantic
// intents only: what to act on and how to prove it worked, never tokens or
// pixels. The grounder maps each intent onto the live window: candidates
// from the stable-id tree, one pick, then the action ladder. Before each
// step a feasibility check stops the run early, with no action taken, when
// the window holds nothing the intent could land on.
// The two judgments are typed hooks for Jev; codeDecisions is the fallback.
import { Effect, Option } from 'effect'
import { actStep, type Point, type Rung } from './cua-ladder.ts'
import { type AxElement, type Call, type DriverError, snapshot, type Target } from './cua-tree.ts'

// Planner output: one semantic step.
export interface Intent {
  label: string
  ocrText?: string
  hint?: Point
  expect: Record<string, unknown>
}

// Jev hooks. pickTarget is a Jev Choice over the candidate elements (option
// ids are AxElement.id). feasible is a Jev yes/no: can this intent still be
// reached from what the window shows? Each returns the code answer when Jev
// is unavailable or below its confidence bar.
export interface Decisions {
  pickTarget(
    intent: Intent,
    candidates: ReadonlyArray<AxElement>,
  ): Effect.Effect<Option.Option<AxElement>>
  feasible(
    goal: string,
    intent: Intent,
    candidates: ReadonlyArray<AxElement>,
  ): Effect.Effect<boolean>
}

const norm = (s: string) => s.trim().toLowerCase()

export const candidatesFor = (intent: Intent, elements: ReadonlyArray<AxElement>) => {
  const want = norm(intent.label)
  return elements.filter((e) => norm(e.label).includes(want) || norm(e.value) === want)
}

// Code fallback: an exact label beats a longer one; ties keep tree order.
export const codeDecisions: Decisions = {
  pickTarget: (intent, candidates) => {
    const want = norm(intent.label)
    const rank = (e: AxElement) => (norm(e.label) === want ? 0 : 1 + e.label.length)
    const best = candidates.reduce<AxElement | undefined>(
      (top, e) => (top === undefined || rank(e) < rank(top) ? e : top),
      undefined,
    )
    return Effect.succeed(Option.fromNullishOr(best))
  },
  feasible: (_goal, intent, candidates) =>
    Effect.succeed(
      candidates.length > 0 || intent.hint !== undefined || intent.ocrText !== undefined,
    ),
}

type Outcome =
  | { status: 'done'; rungs: Rung[] }
  | { status: 'infeasible'; at: string; rungs: Rung[] }

export const runGoal = Effect.fnUntraced(function* (
  call: Call,
  target: Target,
  goal: string,
  intents: ReadonlyArray<Intent>,
  decisions: Decisions = codeDecisions,
): Effect.fn.Return<Outcome, DriverError> {
  const rungs: Rung[] = []
  for (const intent of intents) {
    const candidates = candidatesFor(intent, (yield* snapshot(call, target, false)).elements)
    if (!(yield* decisions.feasible(goal, intent, candidates)))
      return { status: 'infeasible', at: intent.label, rungs }
    const picked = yield* decisions.pickTarget(intent, candidates)
    const elementId = Option.getOrUndefined(Option.map(picked, (e) => e.id))
    rungs.push(yield* actStep(call, target, { ...intent, elementId }))
  }
  return { status: 'done', rungs }
})
