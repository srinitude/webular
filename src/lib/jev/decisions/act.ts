// act: which snapshot element to click next toward a goal, or none. Code builds
// the candidates from snapshot refs; Jev picks one in a Choice asked in both
// option orders; code keeps the pick only when both orders agree at the bar,
// the ref is real, and the click is not destructive (code holds that veto).
import { defineDecision } from '../define.ts'
import {
  agreedPick,
  bothOrders,
  CONFIDENCE_BAR,
  choice,
  menu,
  NONE_OPTION,
  purpose,
} from '../payload/index.ts'

const MAX_CANDIDATES = 30 // context rot: more options cost accuracy
const MAX_NAME = 120
const MAX_GOAL = 300
const CLICKABLE = new Set(['button', 'link', 'tab', 'menuitem', 'checkbox', 'radio', 'option'])
const DESTRUCTIVE =
  /\b(submit|buy|purchase|pay|checkout|check out|place order|order now|delete|remove|erase|unsubscribe|confirm)\b/i
const LINE = /^\s*-\s+(\w+)\s+"([^"]*)".*\[ref=(e\d+)\]/

interface ActCandidate {
  readonly ref: string
  readonly role: string
  readonly name: string
}
interface ActInput {
  readonly goal: string
  readonly candidates: ReadonlyArray<ActCandidate>
}

// Clickable snapshot elements with a ref and a visible name, capped.
export const actCandidates = (snapshot: string): ReadonlyArray<ActCandidate> =>
  snapshot
    .split('\n')
    .flatMap((l) => {
      const m = LINE.exec(l)
      return m?.[1] && m[2] && m[3] && CLICKABLE.has(m[1])
        ? [{ role: m[1], name: m[2].slice(0, MAX_NAME), ref: m[3] }]
        : []
    })
    .slice(0, MAX_CANDIDATES)

const words = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])

// Baseline: the candidate sharing the most goal words; none when no word is shared.
const overlapBaseline = ({ goal, candidates }: ActInput): string => {
  const g = words(goal)
  const overlap = (c: ActCandidate) => [...words(c.name)].filter((w) => g.has(w)).length
  const best = candidates.reduce<ActCandidate | undefined>(
    (b, c) => (overlap(c) > (b ? overlap(b) : 0) ? c : b),
    undefined,
  )
  return best?.ref ?? NONE_OPTION
}

const ACT_PURPOSE = purpose(
  'A browser agent works toward a user goal one click at a time.',
  'Pick the one element whose click moves closest to the goal, or none.',
  'A wrong click wastes a step or leaves the page the user needs.',
  'Pages hold many links and buttons. Names that share goal words are often the wrong ones.',
)

const ACT_INSTRUCTIONS = {
  task: 'Which element in `facts.elements` should the agent click next to reach `facts.goal`? `facts.element_count` says how many elements there are.',
  answer_wanted:
    'Pick the one element whose click most directly leads to what `facts.goal` asks for. Pick none only when no element helps.',
  rules: [
    'Judge each element by where its click leads, read from its role and name, not by how many words it shares with the goal.',
    'A link or tab that opens the page the goal names is a direct step.',
  ],
}

// Asked in both option orders (position check); the baseline's pick is the default.
const actPayload = (full: ActInput) => {
  // Cap the list before any read; the input order is kept (no score to rank by).
  const i = { ...full, candidates: full.candidates.slice(0, MAX_CANDIDATES) }
  const byRef = new Map(i.candidates.map((c) => [c.ref, c]))
  const describe = (ref: string) => {
    const c = byRef.get(ref)
    return c
      ? {
          what: `Click the ${c.role} named "${c.name}" (${ref} in \`facts.elements\`).`,
          not_for: 'When this click leads away from `facts.goal`.',
        }
      : null
  }
  return {
    state: {
      purpose: ACT_PURPOSE,
      facts: {
        goal: i.goal.slice(0, MAX_GOAL),
        element_count: i.candidates.length,
        elements: Object.fromEntries(
          i.candidates.map((c) => [c.ref, { role: c.role, name: c.name }]),
        ),
      },
    },
    questions: bothOrders(
      'next',
      choice(ACT_INSTRUCTIONS, menu(overlapBaseline(i), [...byRef.keys()], describe)),
    ),
  }
}

// A real ref or none, and no destructive click unless the baseline picked it on its own.
const safeClick = (pick: string, i: ActInput) => {
  if (pick === NONE_OPTION) return true
  const c = i.candidates.find((x) => x.ref === pick)
  return c !== undefined && (!DESTRUCTIVE.test(c.name) || overlapBaseline(i) === pick)
}

export const actDecision = defineDecision<ActInput, string>({
  name: 'act.next',
  sample: () => ({
    goal: 'read the pricing plans',
    candidates: [
      { ref: 'e1', role: 'link', name: 'Docs' },
      { ref: 'e2', role: 'link', name: 'Pricing' },
    ],
  }),
  subtasks: [
    {
      name: 'next',
      primitive: 'choice',
      pattern: 'confidence-routing',
      payload: { question: 'next' },
    },
  ],
  payload: actPayload,
  read: (a, t) => agreedPick(a, 'next', t, true),
  bar: CONFIDENCE_BAR,
  fallback: overlapBaseline,
  codeCheck: safeClick,
  evals: 'tests/jev/evals/act.next.json',
  docs: 'b0b26ab933a61b5d43ccccae5fbd009f445bfdcfd2808cac9e410a84f0fd8ca4',
})
