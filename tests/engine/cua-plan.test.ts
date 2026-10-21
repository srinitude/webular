// Cua plan changes, against an in-process fixture app: a fake cua-driver
// transport over one fixture window. Nothing touches the user's apps.
import { describe, expect, test } from 'bun:test'
import { Effect, Option } from 'effect'
import { codeDecisions, runGoal } from '../../src/lib/cua-ground.ts'
import { snapshot, treeText } from '../../src/lib/cua-tree.ts'
import { driverError } from '../../src/lib/driver.ts'

type Args = Record<string, unknown>
const target = { pid: 1, window_id: 2 }
const SIZE = { screenshot_width: 800, screenshot_height: 600 }
const base = [
  { element_index: 0, role: 'AXWindow', label: 'Fixture', parent_index: null },
  { element_index: 1, role: 'AXButton', label: 'Save', parent_index: 0 },
  { element_index: 2, role: 'AXButton', label: 'Save draft', parent_index: 0 },
  { element_index: 3, role: 'AXButton', label: 'Save', parent_index: 0 },
  { element_index: 4, role: 'AXGroup', label: 'Canvas', parent_index: 0 },
  { element_index: 5, role: 'AXStaticText', label: 'Status', value: 'idle', parent_index: 0 },
]

const shifted = (shift: number, snap: number) =>
  base.map((e) => ({
    ...e,
    element_index: e.element_index + shift * snap,
    parent_index: e.parent_index === null ? null : e.parent_index + shift * snap,
    element_token: `tok-${e.element_index}-${snap}`,
  }))

type Reply = (args: Args) => Effect.Effect<string, ReturnType<typeof driverError>>
const json = (value: unknown) => Effect.succeed(JSON.stringify(value))

// Pressing the first "Save" by token sets Saved; the canvas "Publish"
// control is custom drawn, so only a pixel click near its OCR box sets
// Published. Tokens die with each new snapshot.
const clickReply =
  (flags: Set<string>, snap: () => number): Reply =>
  (args) => {
    const token = String(args['element_token'] ?? '')
    if (token && !token.endsWith(`-${snap()}`))
      return Effect.fail(driverError('cua', 'stale token'))
    if (token === `tok-1-${snap()}`) flags.add('Saved')
    if (Math.abs(Number(args['x']) - 440) < 3 && Math.abs(Number(args['y']) - 310) < 3)
      flags.add('Published')
    return json({})
  }

const verifyReply =
  (flags: Set<string>): Reply =>
  (args) => {
    const [want] = args['expect'] as Array<{ element: { selector: { label_contains: string } } }>
    const status = flags.has(String(want?.element.selector.label_contains)) ? 'satisfied' : 'no'
    return json({ structuredContent: { status } })
  }

// One fixture window behind a fake cua-driver transport.
const fixtureApp = (opts: { ocr: boolean; shift?: number }) => {
  const calls: Array<[string, Args]> = []
  const flags = new Set<string>()
  let snap = 0
  const regions = opts.ocr ? [{ text: 'Publish', bbox: { x: 400, y: 300, w: 80, h: 20 } }] : []
  const replies: Record<string, Reply> = {
    get_window_state: () => {
      snap += 1
      const elements = shifted(opts.shift ?? 0, snap)
      return json({ structuredContent: { elements, capture_id: `cap-${snap}`, ...SIZE } })
    },
    click: clickReply(flags, () => snap),
    verify_state: verifyReply(flags),
    parse_visual_regions: () => json({ regions }),
  }
  const call = (tool: string, args: Args) => {
    calls.push([tool, args])
    const reply = replies[tool]
    return reply ? reply(args) : Effect.fail(driverError('cua', `fixture has no ${tool}`))
  }
  return { call, calls }
}

const saved = { element: { selector: { label_contains: 'Saved' }, exists: true } }
const published = { element: { selector: { label_contains: 'Published' }, exists: true } }
const clicks = (calls: Array<[string, Args]>) =>
  calls.filter(([tool]) => tool === 'click').map(([, args]) => args)

describe('cua accessibility tree (2606.30697)', () => {
  test('element ids stay stable when indexes and tokens change', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const app = fixtureApp({ ocr: false, shift: 10 })
        const first = yield* snapshot(app.call, target, false)
        const second = yield* snapshot(app.call, target, false)
        expect(first.elements.map((e) => e.id)).toEqual(second.elements.map((e) => e.id))
        expect(first.elements[1]?.token).not.toBe(second.elements[1]?.token)
        expect(new Set(first.elements.map((e) => e.id)).size).toBe(base.length)
        expect(treeText(first.elements)).toContain('Status: idle')
      }),
    ))
})

describe('cua action ladder (2607.14443)', () => {
  test('accessibility rung acts by token and verifies once', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const app = fixtureApp({ ocr: true })
        const out = yield* runGoal(app.call, target, 'save', [{ label: 'Save', expect: saved }])
        expect(out).toEqual({ status: 'done', rungs: ['ax'] })
        expect(clicks(app.calls)).toHaveLength(1)
      }),
    ))

  test('a custom-drawn control falls through to OCR at normalized coordinates', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const app = fixtureApp({ ocr: true })
        const intent = { label: 'Canvas', ocrText: 'Publish', expect: published }
        const out = yield* runGoal(app.call, target, 'publish', [intent])
        expect(out).toEqual({ status: 'done', rungs: ['ocr'] })
        expect(clicks(app.calls).at(-1)).toMatchObject({ x: 440, y: 310 })
      }),
    ))
})

describe('cua action ladder fallbacks (2607.14443)', () => {
  test('with no OCR text the pixel rung uses the planner hint', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const app = fixtureApp({ ocr: false })
        const intent = { label: 'Canvas', hint: { x: 0.55, y: 310 / 600 }, expect: published }
        const out = yield* runGoal(app.call, target, 'publish', [intent])
        expect(out).toEqual({ status: 'done', rungs: ['pixel'] })
      }),
    ))

  test('a step no rung can verify fails instead of passing', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const app = fixtureApp({ ocr: false })
        const intent = { label: 'Canvas', expect: published }
        const exit = yield* Effect.exit(runGoal(app.call, target, 'publish', [intent]))
        expect(exit._tag).toBe('Failure')
      }),
    ))
})

describe('cua planner and grounder (2505.13227)', () => {
  test('the grounder prefers the exact label over a longer match', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const app = fixtureApp({ ocr: false })
        const { elements } = yield* snapshot(app.call, target, false)
        const picked = yield* codeDecisions.pickTarget(
          { label: 'save', expect: saved },
          [elements[2], elements[1]].filter((e) => e !== undefined),
        )
        expect(Option.getOrUndefined(picked)?.label).toBe('Save')
      }),
    ))

  test('an unreachable goal stops early with no clicks', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const app = fixtureApp({ ocr: true })
        const out = yield* runGoal(app.call, target, 'delete account', [
          { label: 'Delete account', expect: saved },
          { label: 'Save', expect: saved },
        ])
        expect(out).toMatchObject({ status: 'infeasible', at: 'Delete account', rungs: [] })
        expect(clicks(app.calls)).toHaveLength(0)
      }),
    ))
})
