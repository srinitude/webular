// chart/table crop box: Jev says if the target is on the screenshot, how many
// charts match, and where it is (Box). Code clamps the box, checks its edges,
// and turns it into a pixel crop. No box is kept unless every check passes.
import { Option } from 'effect'
import type { JevAnswer, JevImage, JevRequest } from '../client.ts'
import { defineDecision } from '../define.ts'
import { CONFIDENCE_BAR } from '../payload/index.ts'

export const MIN_SIDE_PX = 280 // the API rejects an image side under 280 px
// ponytail: guessed bar; tune it on the chart/table benchmark before relying on it.
const PRESENT_BAR = 0.5
const PAD = 0.02 // fraction of the image added on each side
const LOW_CONF_PAD = 0.05 // more pad when Box confidence is low or null
const LOW_CONF = 0.6

interface Box {
  readonly top: number
  readonly bottom: number
  readonly left: number
  readonly right: number
}
export interface Size {
  readonly width: number
  readonly height: number
}
export interface CropRect extends Size {
  readonly x: number
  readonly y: number
}
interface CropBoxInput {
  readonly question: string
  readonly target: string
  readonly url: string
  readonly title: string
  readonly image: Size & { readonly format: JevImage['format']; readonly base64: string }
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const clampBox = (b: Box): Box => ({
  top: clamp01(b.top),
  bottom: clamp01(b.bottom),
  left: clamp01(b.left),
  right: clamp01(b.right),
})

// Edge-check code scorers on a pixel crop.
export const edgeChecks = (r: CropRect, img: Size) => ({
  nonEmpty: r.width > 0 && r.height > 0,
  inside: r.x >= 0 && r.y >= 0 && r.x + r.width <= img.width && r.y + r.height <= img.height,
  minSize: r.width >= MIN_SIDE_PX && r.height >= MIN_SIDE_PX,
})

// Grow [lo, hi) to at least `min` px around its center, kept inside [0, total).
const span = (lo: number, hi: number, min: number, total: number) => {
  const len = Math.min(total, Math.max(hi - lo, min))
  return { at: Math.min(Math.max(0, Math.round((lo + hi - len) / 2)), total - len), len }
}

// Fractions to a padded, clamped pixel crop; none when the box is empty or fails a check.
export const cropRect = (box: Box, img: Size, confidence: number | null = null) => {
  const b = clampBox(box)
  if (b.right <= b.left || b.bottom <= b.top) return Option.none<CropRect>()
  const pad = confidence !== null && confidence >= LOW_CONF ? PAD : LOW_CONF_PAD
  const px = (f: number, total: number) => Math.min(total, Math.max(0, Math.round(f * total)))
  const h = span(px(b.left - pad, img.width), px(b.right + pad, img.width), MIN_SIDE_PX, img.width)
  const v = span(
    px(b.top - pad, img.height),
    px(b.bottom + pad, img.height),
    MIN_SIDE_PX,
    img.height,
  )
  const rect: CropRect = { x: h.at, y: v.at, width: h.len, height: v.len }
  return Option.liftPredicate(rect, (c) => Object.values(edgeChecks(c, img)).every(Boolean))
}

// A stable reference, so the same screenshot hits the cache and replays.
const refOf = (base64: string) => `screenshot-${Bun.hash(base64).toString(16)}`

const TASK = {
  motivation:
    'Find the chart or table that answers the question, so we can cut it out and read it up close.',
  background:
    'The picture is a screenshot of a web page. It may hold text, pictures, charts, and tables.',
  why: 'A close look at one chart gives better answers than a look at the whole page.',
  outcome:
    'One box around the whole chart or table. Its title, axes, key, and all rows are inside.',
}
const QUESTIONS: JevRequest['questions'] = {
  how_many: {
    type: 'choice',
    instructions: {
      task: 'How many charts or tables in `facts.page.screenshot` could answer `facts.question_from_user`?',
      answer_wanted: 'Pick the one count that fits best.',
    },
    criteria: {
      none: { what: 'None of them answer it.' },
      one: { what: 'Just one answers it.' },
      several: { what: 'More than one could answer it.' },
    },
  },
  is_there: {
    type: 'noul',
    instructions: {
      task: 'Is `facts.target` shown in `facts.page.screenshot`?',
      answer_wanted: 'Yes if it is shown, no if it is not.',
    },
  },
  where: {
    type: 'box',
    instructions: {
      task: '`facts.target` in `facts.page.screenshot`, with its title, axes, key, and all rows',
      answer_wanted: 'The smallest box that holds all of it.',
    },
  },
}

export const cropBoxPayload = (input: CropBoxInput): JevRequest => {
  const { width, height, format, base64 } = input.image
  const ref = refOf(base64)
  const page = { url: input.url, title: input.title, screenshot: ref, size_px: { width, height } }
  return {
    assets: { [ref]: { type: 'image', format, data_base64: base64 } satisfies JevImage },
    state: { ...TASK, facts: { question_from_user: input.question, target: input.target, page } },
    questions: QUESTIONS,
  }
}

// Keep the box only when the target is there, exactly one chart matches, and the crop passes.
export const readCropBox = (a: Record<string, JevAnswer>, img: Size): Option.Option<CropRect> => {
  const box = a['where']?.box
  const present = (a['is_there']?.noul ?? 0) >= PRESENT_BAR
  if (!box || !present || a['how_many']?.choice !== 'one') return Option.none()
  return cropRect(box, img, a['where']?.confidence ?? null)
}

const SAMPLE: CropBoxInput = {
  question: 'Which month had the most sales?',
  target: 'the bar chart of monthly sales',
  url: 'https://example.com/report',
  title: 'Sales report',
  image: { width: 320, height: 320, format: 'png', base64: 'AAAA' },
}

// No Jev, an error, or a failed check: no crop, so the reader gets the full page.
// ponytail: read uses PRESENT_BAR, not the 0.95 bar; tune both on the benchmark.
// The result is the crop, or 'none' (the eval label) when there is no crop.
export const decideCropBox = defineDecision<CropBoxInput, CropRect | 'none'>({
  name: 'chart.crop-box',
  sample: () => SAMPLE,
  // The receipt contract has no box primitive, so the Box rides under the Noul gate.
  subtasks: [
    {
      name: 'how_many',
      primitive: 'choice',
      pattern: 'confidence-routing',
      payload: { question: 'how_many' },
    },
    {
      name: 'is_there',
      primitive: 'noul',
      pattern: 'confidence-routing',
      payload: { question: 'is_there' },
    },
  ],
  payload: cropBoxPayload,
  read: (a, _bar, input) => Option.getOrElse(readCropBox(a, input.image), (): 'none' => 'none'),
  bar: CONFIDENCE_BAR,
  fallback: () => 'none',
  codeCheck: (r, input) => r === 'none' || Object.values(edgeChecks(r, input.image)).every(Boolean),
  evals: 'tests/jev/evals/chart.crop-box.json',
  docs: '88a6a003018eaea50167565a766a0d4a91d039cf93cc7dc2965d3ceba3a72caf',
})
