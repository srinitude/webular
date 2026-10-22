import { describe, expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, Option } from 'effect'
import { Jev } from '../../src/lib/jev/client.ts'
import {
  type CropRect,
  cropBoxPayload,
  cropRect,
  decideCropBox,
  edgeChecks,
  MIN_SIDE_PX,
  readCropBox,
} from '../../src/lib/jev/decisions/crop-box.ts'

const img = { width: 1000, height: 1500 }
const box = { top: 0.2, bottom: 0.5, left: 0.1, right: 0.6 }
const passes = (r: Option.Option<CropRect>, size = img) =>
  Option.match(r, {
    onNone: () => false,
    onSome: (c) => Object.values(edgeChecks(c, size)).every(Boolean),
  })

describe('crop box edge checks', () => {
  test('box inside the image, padded, all checks pass', () => {
    expect(passes(cropRect(box, img, 0.9))).toBe(true)
  })
  test('box past the edges is clamped inside', () => {
    const r = cropRect({ top: -0.2, bottom: 1.4, left: -1, right: 2 }, img, 0.9)
    expect(Option.getOrThrow(r)).toEqual({ x: 0, y: 0, width: 1000, height: 1500 })
  })
  test('a tiny box grows to the minimum size and stays inside', () => {
    const tiny = { top: 0.5, bottom: 0.51, left: 0.98, right: 0.99 }
    const c = Option.getOrThrow(cropRect(tiny, img, 0.9))
    expect(c.width).toBeGreaterThanOrEqual(MIN_SIDE_PX)
    expect(c.height).toBeGreaterThanOrEqual(MIN_SIDE_PX)
    expect(c.x + c.width).toBeLessThanOrEqual(img.width)
  })
  test('an empty or flipped box gives no crop', () => {
    expect(Option.isNone(cropRect({ ...box, bottom: 0.2 }, img))).toBe(true)
    expect(Option.isNone(cropRect({ ...box, top: 0.6 }, img))).toBe(true)
  })
  test('edge checks flag a crop outside, too small, or empty', () => {
    expect(edgeChecks({ x: 900, y: 0, width: 300, height: 300 }, img).inside).toBe(false)
    expect(edgeChecks({ x: 0, y: 0, width: 100, height: 300 }, img).minSize).toBe(false)
    expect(edgeChecks({ x: 0, y: 0, width: 0, height: 300 }, img).nonEmpty).toBe(false)
  })
})

describe('crop box read rule', () => {
  const yes = {
    how_many: { type: 'choice', choice: 'one' },
    is_there: { type: 'noul', noul: 0.9 },
    where: { type: 'box', box, confidence: null },
  }
  test('keeps the box only when present and exactly one chart matches', () => {
    expect(Option.isSome(readCropBox(yes, img))).toBe(true)
    const many = { ...yes, how_many: { type: 'choice', choice: 'several' } }
    expect(Option.isNone(readCropBox(many, img))).toBe(true)
    const absent = { ...yes, is_there: { type: 'noul', noul: 0.1 } }
    expect(Option.isNone(readCropBox(absent, img))).toBe(true)
  })
})

const input = {
  question: 'Which month had the most sales?',
  target: 'the bar chart of monthly sales',
  url: 'https://example.com/report',
  title: 'Sales report',
  image: { width: 320, height: 320, format: 'png' as const, base64: 'AAAA' },
}

test('payload holds one asset, used once in state', () => {
  const req = cropBoxPayload(input)
  const ref = Object.keys(req.assets ?? {})[0] ?? '-'
  expect((req.state['facts'] as Record<string, unknown>)['page']).toMatchObject({ screenshot: ref })
  expect(JSON.stringify(req).split(ref).length - 1).toBe(2) // asset key + one use
})

// Live: skips when Jev is unavailable; otherwise a crop must pass every edge check.
const live = Effect.gen(function* () {
  const jev = yield* Jev
  if (!jev.available) return
  const fs = yield* FileSystem.FileSystem
  const png = yield* fs.readFile('tests/jev/fixtures/bar-chart-320.png')
  const image = { ...input.image, base64: Buffer.from(png).toString('base64') }
  const out = yield* decideCropBox({ ...input, image })
  expect(out === 'none' || passes(Option.some(out), image)).toBe(true)
}).pipe(Effect.provide(Jev.live), Effect.provide(BunServices.layer))

test('live Box call gives a passing crop or none', () => Effect.runPromise(live), 60_000)
