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

const timeBody = (n: number) => {
  const s = bigState(n)
  const t0 = Bun.nanoseconds()
  let body = ''
  for (let i = 0; i < 200; i++) body = requestBytes(JEV_MODEL_DEFAULT, s, Q)
  return { ms: (Bun.nanoseconds() - t0) / 1e6, bytes: body.length }
}

// Fastest of a few runs: a GC pause or a busy machine only ever adds time.
const fastest = (n: number) => {
  const runs = Array.from({ length: 5 }, () => timeBody(n))
  return { ms: Math.min(...runs.map((r) => r.ms)), bytes: runs[0]?.bytes ?? 0 }
}

test('payload time and size stay flat from 10 to 100,000 items', () => {
  timeBody(1_000) // warm the JIT
  const small = fastest(1_000)
  const large = fastest(100_000)
  expect(large.bytes).toBe(small.bytes)
  expect(large.bytes).toBeLessThanOrEqual(CAPS.bytes)
  // A growth ratio, not a millisecond limit, so machine speed cancels out. The
  // input grows 100x, and linear growth would put the time ratio near 100. The
  // `index` field still grows 5x (1,000 to 5,000 keys), so the measured ratio is
  // about 13x. A bound of a quarter of the size ratio (25x) leaves about 2x
  // headroom for noise and still fails on any linear or worse-than-linear walk.
  const sizeRatio = 100_000 / 1_000
  expect(large.ms / small.ms).toBeLessThan(sizeRatio / 4)
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
