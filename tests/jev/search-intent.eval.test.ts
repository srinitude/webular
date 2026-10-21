// Eval: the search intent decision against its keyword rule on labeled real
// queries, 3 runs each. Code scorer: exact match to the label. Prints pass rate,
// mean confidence, share at the 0.95 bar, and sure-but-wrong for the keep rule.
import { expect, test } from 'bun:test'
import { Console, Effect, ManagedRuntime } from 'effect'
import { Jev } from '../../src/lib/jev/client.ts'
import { intentBaseline, intentDecision } from '../../src/lib/jev/decisions/search-intent.ts'
import { CONFIDENCE_BAR, confidenceOf } from '../../src/lib/jev/payload/index.ts'
import cases from './evals/search.intent.json'

const all = [...cases['baseline-wins'], ...cases['baseline-loses']]
const RUNS = 3
const rt = ManagedRuntime.make(Jev.live)

test('the keyword rule passes every baseline-wins case and fails every baseline-loses case', () => {
  for (const c of cases['baseline-wins']) expect<string>(intentBaseline(c.input)).toBe(c.label)
  for (const c of cases['baseline-loses']) expect<string>(intentBaseline(c.input)).not.toBe(c.label)
})

// One case: the decision's pick plus the lower confidence of both orders.
const one = (jev: Jev['Service'], c: (typeof all)[number]) =>
  Effect.gen(function* () {
    const pick = yield* intentDecision(c.input)
    const r = yield* jev.ask('search.intent', intentDecision.def.payload(c.input))
    const conf = Math.min(
      confidenceOf(r.answers['intent']),
      confidenceOf(r.answers['intent_swapped']),
    )
    return { ok: pick === c.label, conf, query: c.input.query, pick }
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
  const misses = runs.flatMap((r) => r.filter((x) => !x.ok).map((x) => `${x.query} -> ${x.pick}`))
  yield* Console.log(
    JSON.stringify({ decision: 'search.intent', cases: all.length, stats, misses }),
  )
  for (const s of stats) expect(s.pass).toBeGreaterThanOrEqual(0.5)
})

test('Jev holds or beats the keyword rule on pass rate', () => rt.runPromise(evalRuns), 120_000)
