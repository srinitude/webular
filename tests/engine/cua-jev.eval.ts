// Labeled eval for the Cua grounder's two judgments: codeDecisions against
// jevDecisions (live Jev, falling back to code). Candidates come from
// candidatesFor, exactly as runGoal builds them. Run:
//   bun tests/engine/cua-jev.eval.ts
// The key comes from TYPESAFE_API_KEY or the Keychain; without one only
// codeDecisions is scored.
import { Config, Console, Effect, Option, Redacted } from 'effect'
import { runMain } from '../../src/core/effect.ts'
import { runProc } from '../../src/core/proc.ts'
import {
  candidatesFor,
  codeDecisions,
  type Decisions,
  type Intent,
} from '../../src/lib/cua-ground.ts'
import { jevDecisions, postJev } from '../../src/lib/cua-jev.ts'
import type { AxElement } from '../../src/lib/cua-tree.ts'

const el = (id: string, role: string, label: string, value = ''): AxElement => ({
  id,
  token: undefined,
  role,
  label,
  value,
  frame: undefined,
})
const intent = (label: string, extra: Partial<Intent> = {}): Intent => ({
  label,
  expect: {},
  ...extra,
})

interface Case {
  name: string
  goal: string
  intent: Intent
  elements: AxElement[]
  pick: string | null // labeled id; null means no element should be picked
  feasible: boolean
}

const save = [
  el('s1', 'AXButton', 'Save'),
  el('s2', 'AXButton', 'Save draft'),
  el('s3', 'AXButton', 'Save'),
]

export const cases: Case[] = [
  {
    name: 'exact label',
    goal: 'Save the file',
    intent: intent('Save'),
    elements: save,
    pick: 's1',
    feasible: true,
  },
  {
    name: 'near-duplicate, longer label wanted',
    goal: 'Keep a draft',
    intent: intent('Save draft'),
    elements: [...save, el('s4', 'AXButton', 'Save draft copy')],
    pick: 's2',
    feasible: true,
  },
  {
    name: 'near-duplicate, no exact label',
    goal: 'Export the report',
    intent: intent('Export'),
    elements: [el('e1', 'AXMenuItem', 'Export…'), el('e2', 'AXMenuItem', 'Export as PDF')],
    pick: 'e1',
    feasible: true,
  },
  {
    name: 'synonym: Sign in vs Log in',
    goal: 'Sign in to the account',
    intent: intent('Sign in'),
    elements: [el('l1', 'AXButton', 'Log in'), el('l2', 'AXLink', 'Create account')],
    pick: null, // candidatesFor finds nothing, so there is nothing to pick
    feasible: true, // the Log in button would do it
  },
  {
    name: 'no match',
    goal: 'Delete the account',
    intent: intent('Delete account'),
    elements: [el('n1', 'AXButton', 'Save'), el('n2', 'AXButton', 'Cancel')],
    pick: null,
    feasible: false,
  },
  {
    name: 'wrong role: label text vs field',
    goal: "Type the user's name",
    intent: intent('Name'),
    elements: [el('r1', 'AXStaticText', 'Name'), el('r2', 'AXTextField', 'Name field')],
    pick: 'r2', // code takes the exact static text; the field is the target
    feasible: true,
  },
  {
    name: 'wrong role: exact field beats heading',
    goal: 'Search for invoices',
    intent: intent('Search'),
    elements: [el('q1', 'AXStaticText', 'Search results'), el('q2', 'AXTextField', 'Search')],
    pick: 'q2',
    feasible: true,
  },
  {
    name: 'stale window',
    goal: 'Send the email to Bob',
    intent: intent('Send'),
    elements: [el('w0', 'AXWindow', 'Finder'), el('w1', 'AXMenuItem', 'Send to Trash')],
    pick: null, // the mail window is gone; the Finder item must not be pressed
    feasible: false,
  },
  {
    name: 'hint only',
    goal: 'Publish the post',
    intent: intent('Publish', { hint: { x: 400, y: 300 } }),
    elements: [el('h1', 'AXGroup', 'Canvas')],
    pick: null,
    feasible: true,
  },
  {
    name: 'ocr only',
    goal: 'Publish the post',
    intent: intent('Publish', { ocrText: 'Publish' }),
    elements: [el('o1', 'AXGroup', 'Canvas')],
    pick: null,
    feasible: true,
  },
  {
    name: 'value match',
    goal: 'Check the status reads idle',
    intent: intent('idle'),
    elements: [el('v1', 'AXStaticText', 'Status', 'idle'), el('v2', 'AXButton', 'Refresh')],
    pick: 'v1',
    feasible: true,
  },
  {
    name: 'duplicate exact labels keep tree order',
    goal: 'Save the file',
    intent: intent('Save'),
    elements: save.filter((e) => e.id !== 's2'),
    pick: 's1', // code is right; Jev cannot tell identical options apart
    feasible: true,
  },
  {
    name: 'short exact beats longer',
    goal: 'Confirm the dialog',
    intent: intent('OK'),
    elements: [el('k1', 'AXButton', "OK, don't ask again"), el('k2', 'AXButton', 'OK')],
    pick: 'k2',
    feasible: true,
  },
]

const idOf = Option.match({ onNone: () => null, onSome: (e: AxElement) => e.id })

const score = (d: Decisions) =>
  Effect.forEach(
    cases,
    (c) => {
      const candidates = candidatesFor(c.intent, c.elements)
      return Effect.all({
        pick: Effect.map(d.pickTarget(c.intent, candidates), idOf),
        feasible: d.feasible(c.goal, c.intent, candidates),
      }).pipe(
        Effect.map((got) => ({
          c,
          got,
          pickOk: got.pick === c.pick,
          feasibleOk: got.feasible === c.feasible,
        })),
      )
    },
    { concurrency: 4 },
  )

const report = Effect.fnUntraced(function* (
  name: string,
  rows: Effect.Success<ReturnType<typeof score>>,
) {
  const n = rows.length
  const pickOk = rows.filter((r) => r.pickOk).length
  const feasibleOk = rows.filter((r) => r.feasibleOk).length
  yield* Console.log(`${name}: pickTarget ${pickOk}/${n}, feasible ${feasibleOk}/${n}`)
  for (const r of rows.filter((r) => !r.pickOk || !r.feasibleOk))
    yield* Console.log(
      `  miss ${r.c.name}: pick ${r.got.pick} (want ${r.c.pick}), feasible ${r.got.feasible} (want ${r.c.feasible})`,
    )
})

// Counts how often the code fallback answered instead of Jev.
const counting = () => {
  const fell = { pickTarget: 0, feasible: 0 }
  const fallback: Decisions = {
    pickTarget: (i, cs) =>
      Effect.suspend(() => {
        fell.pickTarget++
        return codeDecisions.pickTarget(i, cs)
      }),
    feasible: (g, i, cs) =>
      Effect.suspend(() => {
        fell.feasible++
        return codeDecisions.feasible(g, i, cs)
      }),
  }
  return { fell, fallback }
}

// TYPESAFE_API_KEY, else the macOS Keychain item, read inside this process so
// the key never passes through a shell.
const keychainKey = runProc(
  ['security', 'find-generic-password', '-s', 'typesafe-ai-api-key', '-w'],
  {
    timeoutMs: 5_000,
  },
).pipe(
  Effect.map((r) =>
    r.code === 0 && r.stdout.trim() ? Option.some(Redacted.make(r.stdout.trim())) : Option.none(),
  ),
  Effect.orElseSucceed(() => Option.none<Redacted.Redacted<string>>()),
)

const main = Effect.gen(function* () {
  yield* report('code', yield* score(codeDecisions))
  const fromEnv = yield* Config.option(Config.Redacted('TYPESAFE_API_KEY'))
  const key = Option.isSome(fromEnv) ? fromEnv : yield* keychainKey
  if (Option.isNone(key)) {
    yield* Console.log('jev: not run (no TYPESAFE_API_KEY and no Keychain item)')
    return 0
  }
  const { fell, fallback } = counting()
  yield* report('jev', yield* score(jevDecisions(postJev(key.value), fallback)))
  const n = cases.length
  yield* Console.log(
    `  jev answers used: pickTarget ${n - fell.pickTarget}/${n}, feasible ${n - fell.feasible}/${n} (rest fell back to code)`,
  )
  return 0
})

if (import.meta.main) runMain(main)
