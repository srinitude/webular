// Eval: the unknown-command suggestion against its edit-distance rule on typos
// and intent words, 3 runs each. Code scorer: exact match to the label ('none'
// means no suggestion). Prints pass rate, mean confidence, share at the 0.95
// bar, and sure-but-wrong for the keep rule.
import { expect, test } from 'bun:test'
import { Console, Effect, ManagedRuntime } from 'effect'
import { Jev } from '../../src/lib/jev/client.ts'
import { suggestBaseline, suggestDecision } from '../../src/lib/jev/decisions/cli-suggest.ts'
import { CONFIDENCE_BAR, confidenceOf } from '../../src/lib/jev/payload/index.ts'
import cases from './evals/cli.suggest.json'

const all = [...cases['baseline-wins'], ...cases['baseline-loses']]
const RUNS = 3
const rt = ManagedRuntime.make(Jev.live)
// A null label means no suggestion.
test('the edit-distance rule passes every baseline-wins case and fails every baseline-loses case', () => {
  for (const c of cases['baseline-wins']) expect(suggestBaseline(c.input)).toBe(c.label)
  for (const c of cases['baseline-loses']) expect(suggestBaseline(c.input)).not.toBe(c.label)
})

// One case: the decision's pick plus the lower confidence of both orders.
const one = (jev: Jev['Service'], c: (typeof all)[number]) =>
  Effect.gen(function* () {
    const pick = yield* suggestDecision(c.input)
    const r = yield* jev.ask('cli.suggest', suggestDecision.def.payload(c.input))
    const conf = Math.min(
      confidenceOf(r.answers['command']),
      confidenceOf(r.answers['command_swapped']),
    )
    return { ok: pick === c.label, conf, word: c.input.command, pick }
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
  const misses = runs.flatMap((r) => r.filter((x) => !x.ok).map((x) => `${x.word} -> ${x.pick}`))
  yield* Console.log(JSON.stringify({ decision: 'cli.suggest', cases: all.length, stats, misses }))
  for (const s of stats) expect(s.pass).toBeGreaterThanOrEqual(0.5)
})

test(
  'Jev holds or beats the edit-distance rule on pass rate',
  () => rt.runPromise(evalRuns),
  120_000,
)
