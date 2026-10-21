// Enforcement for Jev payloads: bounded size and time, canonical bytes, the
// confidence bar, default-first menus, and the two doors from a workflow.
import { expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, Schema } from 'effect'
import { JEV_MODEL_DEFAULT } from '../../src/lib/jev/client.ts'
import { decisions } from '../../src/lib/jev/decisions.ts'
import {
  CAPS,
  CONFIDENCE_BAR,
  cacheKey,
  canonical,
  menu,
  purpose,
  requestBytes,
  sureShare,
  sureYes,
} from '../../src/lib/jev/payload/index.ts'
import { counted, newCount, total } from './work-count.ts'

// The research payload for a whole state: one batch holding every sub-question.
const researchArg = (s: Parameters<typeof decisions.research>[0]) =>
  decisions.researchPart.def.payload({ s, part: s.subQuestions })

const P = purpose('m', 'o', 'w', 'b')
const parseBody = Schema.decodeUnknownSync(
  Schema.fromJsonString(
    Schema.Struct({
      model: Schema.String,
      questions: Schema.Record(
        Schema.String,
        Schema.Struct({ criteria: Schema.optional(Schema.Unknown) }),
      ),
    }),
  ),
)
const bigState = (n: number) => ({
  purpose: P,
  items: Array.from({ length: n }, (_, i) => ({ url: `https://x.dev/${i}`, text: 'y'.repeat(50) })),
  index: Object.fromEntries(Array.from({ length: Math.min(n, 5_000) }, (_, i) => [`k${i}`, i])),
})
const Q = { q: { type: 'noul', instructions: 'Is `items` useful?' } } as const

// Work the payload walk does on one input: every read, key listing, and key
// check on the state is counted, so the result is exact on every machine.
const workBody = (n: number) => {
  const c = newCount()
  const body = requestBytes(JEV_MODEL_DEFAULT, counted(bigState(n), c), Q)
  return { work: total(c), bytes: body.length }
}

test('payload work and size stay flat from 1,000 to 100,000 items', () => {
  const small = workBody(1_000)
  const large = workBody(100_000)
  expect(large.bytes).toBe(small.bytes)
  expect(large.bytes).toBeLessThanOrEqual(CAPS.bytes)
  // Sound because the measure is a count of state accesses, not wall time: it
  // has no noise, so the bound can be exact. The input grows 100x and the walk
  // must not touch one more value. The growth ratio stays under a quarter of the
  // size ratio (25x), and the exact equality below is stricter still: a linear
  // walk grows the count about 100x, and a walk that reads even one item past
  // the caps grows it too.
  const sizeRatio = 100_000 / 1_000
  expect(large.work / small.work).toBeLessThan(sizeRatio / 4)
  expect(large.work).toBe(small.work)
  expect(small.work).toBeLessThanOrEqual(CAPS.nodes * 3)
})

test('payload budgets hold for every decision on huge input', () => {
  const huge = 'z'.repeat(1_000_000)
  const reqs = [
    decisions.change.def.payload({ url: 'https://a.dev', watchFor: huge, diff: huge }),
    decisions.link.def.payload({
      goal: huge,
      page: { url: huge, title: huge },
      link: { url: huge, anchor: huge },
    }),
    researchArg({
      topic: huge,
      round: 1,
      maxRounds: 3,
      subQuestions: Array.from({ length: 500 }, () => ({ question: huge, bestEvidence: huge })),
    }),
  ]
  for (const r of reqs) {
    const body = requestBytes(JEV_MODEL_DEFAULT, r.state, r.questions)
    expect(body.length).toBeLessThanOrEqual(CAPS.bytes + 1_024)
    expect(() => parseBody(body)).not.toThrow()
  }
  let deep: unknown = 'leaf'
  for (let i = 0; i < 100; i++) deep = { d: deep }
  expect((canonical(deep).match(/\{/g) ?? []).length).toBeLessThanOrEqual(CAPS.depth + 1)
})

test('the same input gives the same bytes, and the body names the model first', () => {
  const a = { purpose: P, b: { y: 2, x: [1, 'two'] }, a: 'one' }
  const b = { a: 'one', b: { x: [1, 'two'], y: 2 }, purpose: P }
  const ba = requestBytes(JEV_MODEL_DEFAULT, a, Q)
  expect(requestBytes(JEV_MODEL_DEFAULT, b, Q)).toBe(ba)
  expect(cacheKey(requestBytes(JEV_MODEL_DEFAULT, b, Q))).toBe(cacheKey(ba))
  expect(ba.startsWith('{"model":"jev-1.13.0","state":')).toBe(true)
  expect(parseBody(ba).model).toBe('jev-1.13.0')
})

test('choice menus put one default first and cap options at 240', () => {
  const keys = Array.from({ length: 300 }, (_, i) => `o${i}`)
  const m = menu('o7', keys)
  expect(Object.keys(m)[0]).toBe('o7')
  expect(Object.keys(m).length).toBe(CAPS.options)
  const q = { c: { type: 'choice', instructions: 'x', criteria: m } } as const
  const body = parseBody(requestBytes(JEV_MODEL_DEFAULT, { purpose: P }, q))
  expect(Object.keys(body.questions['c']?.criteria ?? {}).length).toBe(CAPS.options)
})

test('Jev acts only at 0.95; the log metric counts sure calls', () => {
  expect(CONFIDENCE_BAR).toBe(0.95)
  expect(sureYes({ noul: 0.97 })).toBe(true)
  expect(sureYes({ noul: 0.02 })).toBe(false)
  expect(sureYes({ noul: 0.8 })).toBeUndefined()
  expect(sureShare('{"sure":true}\n{"sure":false}\n{"sure":true}\n{"sure":true}\n')).toBe(0.75)
})

// A raw Jev or model call in a workflow file, outside the two step wrappers.
const RAW =
  /jevRuntime|systemone|\.ask\(|generateText|streamText|\.generate\(|from ['"]@ai-sdk|from ['"]openai|from ['"]@anthropic-ai/
const rawCallers = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const dir = `${import.meta.dir}/../../src/workflows`
  const files = (yield* fs.readDirectory(dir)).filter((f) => f.endsWith('.ts'))
  const texts = yield* Effect.forEach(files, (f) => fs.readFileString(`${dir}/${f}`), {
    concurrency: 8,
  })
  return files.filter((_, i) => RAW.test(texts[i] ?? ''))
}).pipe(Effect.provide(BunServices.layer))

test('workflows reach Jev or a model only through decisionStep or promptStep', () =>
  Effect.runPromise(rawCallers.pipe(Effect.map((bad) => expect(bad).toEqual([])))))
