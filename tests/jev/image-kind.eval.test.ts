// Eval: the image kind decision. Code scorers first: the blunt baseline wins only where
// an image is read anyway, every pilot image id has a label, and the payload carries the
// images, the model, and both option orders. The live part skips when Jev is unavailable.
import { expect, test } from 'bun:test'
import { Console, Effect, ManagedRuntime } from 'effect'
import { Jev } from '../../src/lib/jev/client.ts'
import {
  type ImageKind,
  type ImageKindInput,
  imageKindBaseline,
  imageKindDecision,
} from '../../src/lib/jev/decisions/image-kind.ts'
import cases from './evals/image.kind.json'

const sample = imageKindDecision.def.sample()
const rt = ManagedRuntime.make(Jev.live)
const labeled = [...cases['baseline-wins'], ...cases['baseline-loses']]

test('the baseline passes every baseline-wins case and fails every baseline-loses case', () => {
  expect(cases['baseline-wins'].length).toBeGreaterThan(0)
  expect(cases['baseline-loses'].length).toBeGreaterThan(0)
  for (const c of cases['baseline-wins'])
    expect(imageKindBaseline(c.input as ImageKindInput)).toEqual(c.label as ImageKind[])
  for (const c of cases['baseline-loses'])
    expect(imageKindBaseline(c.input as ImageKindInput)).not.toEqual(c.label as ImageKind[])
})

test('every pilot image id has a label', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const text = yield* Effect.promise(() =>
        Bun.file('bench/tasks/dev/pilot-images.jsonl').text(),
      )
      const ids = [...text.matchAll(/"id":"(pilot-images-[a-z0-9-]+)"/g)].map((m) => m[1] ?? '')
      expect(ids.length).toBeGreaterThan(0)
      expect(labeled.map((c) => c.id).sort()).toEqual(ids.sort())
    }),
  ))

test('the payload holds the images and both option orders', () => {
  const req = imageKindDecision.def.payload(sample)
  expect(Object.keys(req.assets ?? {})).toEqual(sample.images.map((p) => p.ref))
  for (let i = 0; i < sample.images.length; i++) {
    expect(Object.keys(req.questions)).toContain(`kind_${i}`)
    expect(Object.keys(req.questions)).toContain(`kind_${i}_swapped`)
  }
})

const live = Effect.gen(function* () {
  const jev = yield* Jev
  if (!jev.available) return
  const kinds = yield* imageKindDecision(sample)
  yield* Console.log(JSON.stringify({ decision: 'image.kind', kinds }))
  expect(kinds).toHaveLength(sample.images.length)
})

test('Jev returns one kind per image', () => rt.runPromise(live), 60_000)
