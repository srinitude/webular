// Cua action ladder (paper 2607.14443): accessibility first, then OCR, then
// pixels, with a verify_state check after every action. A rung that cannot
// address the step is skipped; a rung whose action does not verify hands off
// to the next. Only background delivery is used: no delivery_mode, no
// focus, clipboard, keyboard, or sound.
// Coordinate contract: every OCR or pixel target is a normalized Point
// (0..1 of the window screenshot), turned into screenshot pixels only at
// click time, against the size of the capture the click consumes.
import { Effect, Option, Schema } from 'effect'
import { type Call, fieldsOf, type Size, snapshot, type Target } from './cua-tree.ts'
import { driverError } from './driver.ts'

export interface Point {
  x: number
  y: number
}

export type Rung = 'ax' | 'ocr' | 'pixel'

// One grounded step: the element the grounder picked (by stable id), the
// text OCR looks for, the planner's normalized hint, and the verify_state
// predicate that proves the step worked.
interface LadderStep {
  elementId?: string | undefined
  label: string
  ocrText?: string | undefined
  hint?: Point | undefined
  expect: Record<string, unknown>
}

type ClickArgs = Record<string, unknown>
type Locate = (
  call: Call,
  captureId: string,
  size: Size,
  step: LadderStep,
) => Effect.Effect<Option.Option<Point>>

const toPixels = (p: Point, size: Size) => ({
  x: Math.round(Math.min(1, Math.max(0, p.x)) * size.width),
  y: Math.round(Math.min(1, Math.max(0, p.y)) * size.height),
})

const Box = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  w: Schema.Number,
  h: Schema.Number,
})
// ponytail: region shape read from bbox or frame, not yet seen live: the
// host lacks the cua-perception extension, so the real reply is a refusal
// (tests/fixtures/cua/parse-visual-regions.json) that fails this decode and
// skips the OCR rung. Narrow once a live regions reply is captured.
const Region = Schema.Struct({
  text: Schema.optional(Schema.String),
  bbox: Schema.optional(Box),
  frame: Schema.optional(Box),
})
export const Regions = Schema.Struct({ regions: Schema.Array(Region) })
const decodeRegions = Schema.decodeUnknownEffect(Regions)

const axRung = (call: Call, target: Target, step: LadderStep) =>
  Effect.map(snapshot(call, target, false), ({ elements }) =>
    Option.map(
      Option.fromNullishOr(elements.find((e) => step.elementId && e.id === step.elementId)?.token),
      (token): ClickArgs => ({ element_token: token }),
    ),
  )

const findText: Locate = (call, captureId, size, step) =>
  Effect.gen(function* () {
    const args = { capture_id: captureId, options: { kinds: ['text'] } }
    const { regions } = yield* decodeRegions(
      yield* fieldsOf(yield* call('parse_visual_regions', args)),
    )
    const want = (step.ocrText ?? step.label).toLowerCase()
    const hit = regions.find((r) => r.text?.toLowerCase().includes(want) && (r.bbox ?? r.frame))
    const box = hit?.bbox ?? hit?.frame
    if (!box) return Option.none<Point>()
    return Option.some({
      x: (box.x + box.w / 2) / size.width,
      y: (box.y + box.h / 2) / size.height,
    })
  }).pipe(Effect.orElseSucceed(() => Option.none<Point>()))

const fromHint: Locate = (_call, _captureId, _size, step) =>
  Effect.succeed(Option.fromNullishOr(step.hint))

// OCR and pixel rungs share one shape: locate a normalized point on a fresh
// capture, then click that point in the capture's pixels, consuming it.
const captureRung = (locate: Locate) => (call: Call, target: Target, step: LadderStep) =>
  Effect.gen(function* () {
    const { captureId, size } = yield* snapshot(call, target, true)
    if (!captureId || !size) return Option.none<ClickArgs>()
    const point = yield* locate(call, captureId, size, step)
    return Option.map(point, (p): ClickArgs => ({ ...toPixels(p, size), capture_id: captureId }))
  })

const rungs: ReadonlyArray<readonly [Rung, typeof axRung]> = [
  ['ax', axRung],
  ['ocr', captureRung(findText)],
  ['pixel', captureRung(fromHint)],
]

// verify_state reply (tests/fixtures/cua/verify-state.json): one overall
// status plus per-predicate reasons. unknown is never success on its own.
// A satisfied predicate carries unknown_reason null
// (tests/fixtures/cua/verify-state-satisfied.json).
export const Verified = Schema.Struct({
  status: Schema.Literals(['satisfied', 'unsatisfied', 'unknown']),
  predicates: Schema.optional(
    Schema.Array(Schema.Struct({ unknown_reason: Schema.optional(Schema.NullOr(Schema.String)) })),
  ),
})
const decodeVerified = Schema.decodeUnknownEffect(Verified)

// The planner's "shows this text" predicate (cua-goal.ts).
const Shows = Schema.Struct({
  element: Schema.Struct({
    selector: Schema.Struct({ label_contains: Schema.String }),
    exists: Schema.Literal(true),
  }),
})
const decodeShows = Schema.decodeUnknownOption(Shows)

// verify_state refuses to trust web page content (untrusted_source), so one
// fresh tree read of the same window decides instead: it passes only if an
// element's label or value contains the expected text. One read, no loop.
const treeShows = (call: Call, target: Target, expect: Record<string, unknown>) =>
  Option.match(decodeShows(expect), {
    onNone: () => Effect.succeed(false),
    onSome: ({
      element: {
        selector: { label_contains: text },
      },
    }) =>
      Effect.map(snapshot(call, target, false), ({ elements }) =>
        elements.some((e) => e.label.includes(text) || e.value.includes(text)),
      ),
  })

export const verified = (call: Call, target: Target, expect: Record<string, unknown>) =>
  Effect.gen(function* () {
    const v = yield* decodeVerified(
      yield* fieldsOf(yield* call('verify_state', { ...target, expect: [expect] })),
    )
    if (v.status === 'satisfied') return true
    const untrusted =
      v.status === 'unknown' &&
      (v.predicates ?? []).some((p) => p.unknown_reason === 'untrusted_source')
    return untrusted && (yield* treeShows(call, target, expect))
  }).pipe(Effect.orElseSucceed(() => false))

export const actStep = Effect.fnUntraced(function* (call: Call, target: Target, step: LadderStep) {
  for (const [name, rung] of rungs) {
    const args = yield* rung(call, target, step)
    if (Option.isNone(args)) continue
    yield* call('click', { ...target, ...args.value })
    if (yield* verified(call, target, step.expect)) return name
  }
  return yield* driverError('cua', `no rung verified step "${step.label}"`)
})
