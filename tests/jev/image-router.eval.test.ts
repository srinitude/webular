// Eval: the image router against the take-every-image baseline on labeled
// questions, 3 runs each. Code scorers first (baseline, zero-image skip,
// inventory build); the live part skips when Jev is unavailable. Prints pass
// rate, mean confidence, share at the bar, and sure-but-wrong.
import { expect, test } from 'bun:test'
import assert from 'node:assert/strict'
import { Console, Effect, Layer, ManagedRuntime } from 'effect'
import { Jev } from '../../src/lib/jev/client.ts'
import {
  imageInventory,
  type RouterInput,
  routeBaseline,
  routeDecision,
  routeImages,
} from '../../src/lib/jev/decisions/image-router.ts'
import { CONFIDENCE_BAR, confidenceOf } from '../../src/lib/jev/payload/index.ts'
import cases from './evals/image.router.json'

type Case = { id: string; label: string; input: RouterInput }
const wins = cases['baseline-wins'] as ReadonlyArray<Case>
const loses = cases['baseline-loses'] as ReadonlyArray<Case>
const all = [...wins, ...loses]
const RUNS = 3
const rt = ManagedRuntime.make(Jev.live)

test('the baseline passes every baseline-wins case and fails every baseline-loses case', () => {
  for (const c of wins) expect<string>(routeBaseline(c.input)).toBe(c.label)
  for (const c of loses) expect<string>(routeBaseline(c.input)).not.toBe(c.label)
})

// The pilot keep rule failed only for infographics, so they stay on text, with no Jev call.
test('an infographic page skips the router and answers text', () => {
  const noCall = Layer.succeed(
    Jev,
    Jev.of({ available: true, ask: () => Effect.die('no Jev call for an infographic page') }),
  )
  return Effect.runPromise(
    routeImages(routeDecision.def.sample(), 'infographic').pipe(
      Effect.provide(noCall),
      Effect.map((route) => expect(route).toBe('text')),
    ),
  )
})

test('zero images skips the router and answers text', () => {
  const first = loses[0]
  assert.ok(first)
  return rt.runPromise(
    routeImages({ ...first.input, images: [] }).pipe(
      Effect.map((route) => expect(route).toBe('text')),
    ),
  )
})

test('the payload asks both option orders and carries no image bytes', () => {
  const first = all[0]
  assert.ok(first)
  const req = routeDecision.def.payload(first.input)
  expect(Object.keys(req.questions)).toEqual(['route', 'route_swapped'])
  expect(JSON.stringify(req)).not.toContain('data:image')
})

test('the inventory build cuts to 8 images and guesses a kind from the file name', () => {
  const raw = Array.from({ length: 10 }, (_, i) => ({
    src: `https://a.dev/img/chart-${i}.png?v=1`,
    alt: '',
    caption: '',
    width: 400,
    height: 300,
    near: '',
  }))
  const inv = imageInventory(raw)
  expect(inv.length).toBe(8)
  expect(inv[0]).toMatchObject({ file: 'chart-0.png', kind: 'chart' })
})

const one = (jev: Jev['Service'], c: Case) =>
  Effect.gen(function* () {
    const pick = yield* routeDecision(c.input)
    const r = yield* jev.ask('image.router', routeDecision.def.payload(c.input))
    const conf = Math.min(
      confidenceOf(r.answers['route']),
      confidenceOf(r.answers['route_swapped']),
    )
    return { ok: pick === c.label, conf, id: c.id, pick }
  })

const summary = (r: ReadonlyArray<{ ok: boolean; conf: number }>) => ({
  pass: r.filter((x) => x.ok).length / r.length,
  meanConf: r.reduce((s, x) => s + x.conf, 0) / r.length,
  sure: r.filter((x) => x.conf >= CONFIDENCE_BAR).length / r.length,
  sureWrong: r.filter((x) => x.conf >= CONFIDENCE_BAR && !x.ok).length,
})

const evalRuns = Effect.gen(function* () {
  const jev = yield* Jev
  if (!jev.available) return
  const runs = yield* Effect.forEach(
    Array.from({ length: RUNS }),
    () => Effect.forEach(all, (c) => one(jev, c), { concurrency: 8 }),
    { concurrency: 1 },
  )
  const stats = runs.map(summary)
  const misses = runs.flatMap((r) => r.filter((x) => !x.ok).map((x) => `${x.id} -> ${x.pick}`))
  yield* Console.log(JSON.stringify({ decision: 'image.router', cases: all.length, stats, misses }))
  for (const s of stats) expect(s.pass).toBeGreaterThanOrEqual(0.5)
})

test(
  'Jev holds or beats the take-every-image baseline on pass rate',
  () => rt.runPromise(evalRuns),
  120_000,
)
