// Cua window snapshot with stable element ids (paper 2606.30697).
// get_window_state returns per-snapshot element_index values and tokens that
// die with the next snapshot. A stable id hashes the element's role|label
// path from the window root plus its ordinal among same-path siblings, so a
// plan can name an element across snapshots and re-find its fresh token.
// The installed cua-driver's get_accessibility_tree is a desktop-level window
// list, so the per-window tree comes from get_window_state.
import { Effect, Option, Predicate, Schema } from 'effect'
import { driverError } from './driver.ts'

export type DriverError = ReturnType<typeof driverError>

export type Call = (
  tool: string,
  args: Record<string, unknown>,
) => Effect.Effect<string, DriverError>

export interface Target {
  pid: number
  window_id: number
}

const MAX_DEPTH = 25

const Fields = Schema.Record(Schema.String, Schema.Unknown)
const decodeFields = Schema.decodeUnknownEffect(Schema.fromJsonString(Fields))
const decodeNested = Schema.decodeUnknownOption(Fields)

// A tool result carries its fields at the top level or under
// structuredContent; one decode merges both, structuredContent winning.
export const fieldsOf = (stdout: string) =>
  Effect.map(decodeFields(stdout), (top) => ({
    ...top,
    ...Option.getOrElse(decodeNested(top['structuredContent']), () => ({})),
  }))

const Frame = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  w: Schema.Number,
  h: Schema.Number,
})
const RawElement = Schema.Struct({
  element_index: Schema.Number,
  element_token: Schema.optional(Schema.String),
  role: Schema.String,
  label: Schema.optional(Schema.NullOr(Schema.String)),
  value: Schema.optional(Schema.Unknown),
  frame: Schema.optional(Frame),
  parent_index: Schema.optional(Schema.NullOr(Schema.Number)),
})
type RawElement = typeof RawElement.Type
const Snapshot = Schema.Struct({
  elements: Schema.Array(RawElement),
  capture_id: Schema.optional(Schema.String),
  screenshot_width: Schema.optional(Schema.Number),
  screenshot_height: Schema.optional(Schema.Number),
})
const decodeSnapshot = Schema.decodeUnknownEffect(Snapshot)
// The screenshot bytes ride in the MCP content list as an image item.
const Content = Schema.Array(
  Schema.Struct({
    type: Schema.String,
    data: Schema.optional(Schema.String),
    mimeType: Schema.optional(Schema.String),
  }),
)
const FORMATS: Record<string, 'png' | 'jpg'> = { 'image/png': 'png', 'image/jpeg': 'jpg' }
const imageOf = (content: unknown) =>
  Option.flatMap(Schema.decodeUnknownOption(Content)(content), (items) =>
    Option.fromNullishOr(
      items
        .filter((i) => i.type === 'image' && i.data && FORMATS[i.mimeType ?? ''])
        .map((i) => ({ base64: i.data ?? '', format: FORMATS[i.mimeType ?? ''] ?? 'png' }))[0],
    ),
  )

export interface AxElement {
  id: string
  token: string | undefined
  role: string
  label: string
  value: string
  frame: typeof Frame.Type | undefined
}

export interface Size {
  width: number
  height: number
}

const keyOf = (e: RawElement) => `${e.role}|${e.label ?? ''}`

const pathOf = (byIndex: ReadonlyMap<number, RawElement>, e: RawElement) => {
  const parts: string[] = []
  let cur: RawElement | undefined = e
  while (cur && parts.length < MAX_DEPTH) {
    parts.unshift(keyOf(cur))
    cur = cur.parent_index == null ? undefined : byIndex.get(cur.parent_index)
  }
  return parts.join('/')
}

const withStableIds = (raw: ReadonlyArray<RawElement>): AxElement[] => {
  const byIndex = new Map(raw.map((e) => [e.element_index, e]))
  const seen = new Map<string, number>()
  return raw.map((e) => {
    const path = pathOf(byIndex, e)
    const ordinal = seen.get(path) ?? 0
    seen.set(path, ordinal + 1)
    return {
      id: Bun.hash(`${path}#${ordinal}`).toString(36),
      token: e.element_token,
      role: e.role,
      label: e.label ?? '',
      value: Predicate.isString(e.value) ? e.value : '',
      frame: e.frame,
    }
  })
}

// One snapshot of the exact target window. `withShot` asks for the
// screenshot capture the OCR and pixel rungs need; the tree-only read is the
// cheap path.
export const snapshot = (call: Call, target: Target, withShot: boolean) =>
  Effect.gen(function* () {
    const args = { ...target, include_screenshot: withShot }
    const fields = yield* fieldsOf(yield* call('get_window_state', args))
    const snap = yield* decodeSnapshot(fields)
    const size =
      snap.screenshot_width && snap.screenshot_height
        ? { width: snap.screenshot_width, height: snap.screenshot_height }
        : undefined
    const image = withShot ? imageOf(fields['content']) : Option.none()
    return { elements: withStableIds(snap.elements), captureId: snap.capture_id, size, image }
  }).pipe(
    Effect.mapError((err) =>
      err._tag === 'DriverError' ? err : driverError('cua', 'get_window_state: no element tree'),
    ),
  )

// Tree text for readers: one line per labeled element, "label: value".
export const treeText = (elements: ReadonlyArray<AxElement>) =>
  elements
    .filter((e) => e.label || e.value)
    .map((e) => (e.value && e.value !== e.label ? `${e.label}: ${e.value}` : e.label || e.value))
    .join('\n')
