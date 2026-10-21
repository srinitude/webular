// The jev mod's DEFINITION rules: the definer rejects an alias model at the type
// level, and lintDefinition and lintSubtasks reject every other bad payload.
import { expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem } from 'effect'
import { JEV_MODEL_DEFAULT, type JevRequest } from '../../src/lib/jev/client.ts'
import { decisions } from '../../src/lib/jev/decisions.ts'
import type { DecisionDef } from '../../src/lib/jev/define.ts'
import { fetchBlockDecision, fetchErrorDecision } from '../../src/lib/jev/fetch.ts'
import { fetchBrowserDecision } from '../../src/lib/jev/fetch-browser.ts'
import { estTokens } from '../../src/lib/jev/learn/definition-lint.ts'
import { lintDefinition, lintSubtasks } from '../../src/lib/jev/learn/lint.ts'
import { nextEvent } from '../../src/lib/jev/machine.ts'

const GOOD_STATE = {
  purpose: { motivation: 'm', outcome: 'o', why: 'w', background: 'b' },
  facts: { page: { url: 'https://a.dev' } },
}
const good = {
  model: 'jev-1.13.0',
  state: GOOD_STATE,
  questions: {
    pick: {
      type: 'choice',
      instructions: { task: 'Pick the page kind.' },
      criteria: { docs: { what: 'a docs page' }, blog: { what: 'a blog post' } },
    },
    rate: {
      type: 'score',
      instructions: { task: 'Rate fit.' },
      criteria: [{ what: 'poor' }, { description: 'good' }],
    },
  },
}
const rules = (req: Parameters<typeof lintDefinition>[0]) => lintDefinition(req).map((f) => f.rule)
const noul = (t: string) => ({ type: 'noul', instructions: { t } })

test('definition: a payload that meets every rule has no findings', () => {
  expect(lintDefinition(good)).toEqual([])
  const step = { name: 's', primitive: 'choice', pattern: 'none', payload: good }
  expect(lintSubtasks([step, { route: 'code' }])).toEqual([])
})

test('definition: bare instructions, thin options and levels, and flat state are errors', () => {
  const bad = rules({
    model: 'jev-1.13.0',
    state: { facts: 'x' },
    questions: {
      a: { type: 'choice', instructions: 'pick', criteria: { only: { what: 'one' } } },
      b: { type: 'choice', instructions: { t: 1 }, criteria: { x: 'bare', y: { what: 'ok' } } },
      c: { type: 'score', instructions: { t: 1 }, criteria: [{ what: 'one' }] },
      d: { type: 'score', instructions: { t: 1 }, criteria: ['low', { what: 'high' }] },
    },
  })
  expect(bad.filter((r) => r === 'instructions-object').length).toBe(1)
  expect(bad.filter((r) => r === 'choice-criteria').length).toBe(2)
  expect(bad.filter((r) => r === 'score-levels').length).toBe(2)
  // missing motivation, outcome, why, background, plus depth under 2
  expect(bad.filter((r) => r === 'state-shape').length).toBe(5)
  const eleven = Array.from({ length: 11 }, (_, i) => ({ what: `${i}` }))
  const q = { type: 'score', instructions: { t: 1 }, criteria: eleven }
  expect(rules({ ...good, questions: { q } })).toEqual(['score-levels'])
})

test('definition: alias models, box without jev-preview, size and nesting caps', () => {
  for (const model of ['jev', 'jev-latest', '~fast', 'jev-1.13', 'gpt-5'])
    expect(rules({ ...good, model })).toEqual(['model-pin'])
  const box = { b: { type: 'box', instructions: { t: 1 } } }
  expect(rules({ ...good, questions: box })).toEqual(['box-model'])
  expect(rules({ ...good, model: 'jev-preview', questions: box })).toEqual([])
  expect(rules({ ...good, questions: { a: noul('q'.repeat(130_000)) } })).toContain('question-size')
  const wide = {
    a: noul('q'.repeat(90_000)),
    b: noul('r'.repeat(90_000)),
    c: noul('s'.repeat(90_000)),
  }
  expect(rules({ ...good, questions: wide })).toEqual(['request-size'])
  let deep: unknown = 'leaf'
  for (let i = 0; i < 70; i++) deep = { d: deep }
  expect(rules({ ...good, state: { ...GOOD_STATE, deep } })).toContain('nesting')
})

test('definition: warnings for none-of-the-above, near duplicates, and big state', () => {
  const criteria = {
    Yes: { what: 'y' },
    'yes ': { what: 'y2' },
    'None of the above': { what: 'n' },
  }
  const found = lintDefinition({
    ...good,
    state: { ...GOOD_STATE, blob: 'z'.repeat(9_000) },
    questions: { c: { type: 'choice', instructions: { t: 1 }, criteria } },
  })
  expect(found.map((f) => [f.rule, f.level])).toEqual([
    ['state-size', 'warning'],
    ['near-duplicate-options', 'warning'],
    ['none-of-the-above', 'warning'],
  ])
})

test('definition: a Jev step needs a primitive, a pattern, and a full payload', () => {
  const found = lintSubtasks([
    { primitive: 'write', pattern: 'loop', payload: { question: 'q' } },
    { primitive: 'noul', pattern: 'fan-out', payload: { ...good, model: 'jev-latest' } },
  ])
  expect(found.map((f) => [f.rule, f.where])).toEqual([
    ['subtask-shape', 'subtasks.0.primitive'],
    ['subtask-shape', 'subtasks.0.pattern'],
    ['subtask-shape', 'subtasks.0.payload'],
    ['model-pin', 'subtasks.1.payload.model'],
  ])
})

test('definition: defineDecision rejects an alias model at the type level', () => {
  type Model = NonNullable<DecisionDef<never, never>['model']>
  const pinned: Model = 'jev-1.13.0'
  const preview: Model = 'jev-preview'
  // @ts-expect-error jev-latest is an alias, not a pinned model
  const latest: Model = 'jev-latest'
  // @ts-expect-error a ~alias is not a pinned model
  const tilde: Model = '~fast'
  expect([pinned, preview, latest, tilde].length).toBe(4)
})

// Limits are tokens (llms-full.txt L14441, L14452-14457), estimated as chars / 4,
// and the per-question limit counts the state too.
test('definition: size caps use the chars / 4 token estimate, state included per question', () => {
  expect(estTokens('x'.repeat(399))).toBe(101) // 401 chars with the JSON quotes
  expect(rules({ ...good, questions: { a: noul('q'.repeat(120_000)) } })).toEqual([])
  const bigState = { ...GOOD_STATE, notes: { text: 'n'.repeat(100_000) } }
  expect(rules({ ...good, state: bigState, questions: { a: noul('q'.repeat(40_000)) } })).toContain(
    'question-size',
  )
})

// Every DecisionDef in src: the registry, plus the decisions defined beside their
// users. The scan below counts defineDecision calls, so a new decision that is not
// listed here fails the count and cannot skip lint.
interface Listed {
  readonly def: Pick<DecisionDef<never, unknown>, 'name' | 'model' | 'subtasks'> & {
    readonly payload: (i: never) => JevRequest
    readonly sample: () => unknown
  }
}
// Wrappers such as mapOrder carry a partial `def` with no payload; they define nothing.
const listed = (d: object): ReadonlyArray<Listed> =>
  'payload' in (Reflect.get(d, 'def') ?? {}) ? [d as Listed] : []
const ALL: ReadonlyArray<Listed> = [
  ...Object.values(decisions).flatMap(listed),
  ...[fetchErrorDecision, fetchBlockDecision, fetchBrowserDecision, nextEvent].flatMap(listed),
]

const scannedCalls = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const root = `${import.meta.dir}/../../src`
  const files = (yield* fs.readDirectory(root, { recursive: true })).filter(
    (f) => f.endsWith('.ts') && f !== 'lib/jev/define.ts',
  )
  const texts = yield* Effect.forEach(files, (f) => fs.readFileString(`${root}/${f}`), {
    concurrency: 16,
  })
  return texts.reduce((n, t) => n + (t.match(/\bdefineDecision\s*[<(]/g) ?? []).length, 0)
}).pipe(Effect.provide(BunServices.layer))

test('definition: lint covers every defineDecision call in src', () =>
  Effect.runPromise(
    scannedCalls.pipe(
      Effect.map((calls) => {
        expect(ALL.length).toBe(calls)
        expect(new Set(ALL.map((d) => d.def.name)).size).toBe(calls)
        return calls
      }),
    ),
  ))

// The five payload-shape rules below are open debt: today's payloads use bare-string
// instructions and options, flat state, and unfilled subtask payloads. Each decision
// is held to every other rule now (model pin, box model, size caps, nesting). Remove
// a rule from this list as the payloads are fixed; an empty list is the end state.
const SHAPE_DEBT: ReadonlySet<string> = new Set([
  'instructions-object',
  'choice-criteria',
  'score-levels',
  'state-shape',
  'subtask-shape',
])

test('definition: every decision payload and subtask list has no new lint errors', () => {
  for (const { def } of ALL) {
    const built = (def.payload as (i: unknown) => JevRequest)(def.sample())
    const req = { ...built, model: def.model ?? JEV_MODEL_DEFAULT }
    const errors = [...lintDefinition(req), ...lintSubtasks(def.subtasks)]
      .filter((f) => f.level === 'error' && !SHAPE_DEBT.has(f.rule))
      .map((f) => `${f.rule} ${f.where}`)
    expect([def.name, errors]).toEqual([def.name, []])
  }
})
