// Eval: the page title decision against its rule (Readability, else <title>)
// on labeled pages, 3 runs each. Code scorer: the pick is one of the accepted
// titles. Prints pass rate, mean confidence, share at the bar, and sure-but-wrong.
import { expect, test } from 'bun:test'
import { Console, Effect, ManagedRuntime } from 'effect'
import { Jev } from '../../src/lib/jev/client.ts'
import { titleBaseline, titleDecision } from '../../src/lib/jev/decisions/page-title.ts'
import { CONFIDENCE_BAR, confidenceOf } from '../../src/lib/jev/payload/index.ts'
import cases from './evals/page.title.json'

const all = [...cases['baseline-wins'], ...cases['baseline-loses']]
const RUNS = 3
const rt = ManagedRuntime.make(Jev.live)

test('the rule passes every baseline-wins case and fails every baseline-loses case', () => {
  for (const c of cases['baseline-wins']) expect(c.ok).toContain(titleBaseline(c.input))
  for (const c of cases['baseline-loses']) expect(c.ok).not.toContain(titleBaseline(c.input))
})

const one = (jev: Jev['Service'], c: (typeof all)[number]) =>
  Effect.gen(function* () {
    const pick = yield* titleDecision(c.input)
    const r = yield* jev.ask('page.title', titleDecision.def.payload(c.input))
    const conf = Math.min(
      confidenceOf(r.answers['title']),
      confidenceOf(r.answers['title_swapped']),
    )
    return { ok: c.ok.includes(pick), conf, url: c.input.url, pick }
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
  const misses = runs.flatMap((r) => r.filter((x) => !x.ok).map((x) => `${x.url} -> ${x.pick}`))
  yield* Console.log(JSON.stringify({ decision: 'page.title', cases: all.length, stats, misses }))
  for (const s of stats) expect(s.pass).toBeGreaterThanOrEqual(0.5)
})

test('Jev holds or beats the title rule on pass rate', () => rt.runPromise(evalRuns), 120_000)
