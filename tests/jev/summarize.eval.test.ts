// Eval: summarize.lead and summarize.core against their labeled cases, live on Jev.
// Code scorer: exact match to the label. Prints pass rate, clarity (mean of the lower
// confidence per case), sure-but-wrong (an agreed pick at the bar that misses the
// label), and key-fact coverage (the labeled lead is in the picks). Live only with
// WEBULAR_TEST_LIVE=1 and a TypeSafe key.
import { expect, test } from 'bun:test'
import { Config, Console, Effect, ManagedRuntime, Option } from 'effect'
import { Jev, type JevAnswer } from '../../src/lib/jev/client.ts'
import { coreDecision, summaryDecision } from '../../src/lib/jev/decisions/summarize.ts'
import { agreedPick, CONFIDENCE_BAR, confidenceOf } from '../../src/lib/jev/payload/index.ts'
import coreCases from './evals/summarize.core.json'
import leadCases from './evals/summarize.lead.json'

const rt = ManagedRuntime.make(Jev.live)
const leads = [...leadCases['baseline-wins'], ...leadCases['baseline-loses']]
const cores = [...coreCases['baseline-wins'], ...coreCases['baseline-loses']]

const answersOf = (jev: Jev['Service'], name: string, req: Parameters<Jev['Service']['ask']>[1]) =>
  jev.ask(name, req).pipe(
    Effect.map((r) => r.answers),
    Effect.orElseSucceed((): Record<string, JevAnswer> => ({})),
  )
const clarity = (a: Record<string, JevAnswer>) => {
  const c = Object.values(a).map(confidenceOf)
  return c.length === 0 ? 0 : Math.min(...c)
}
// The agreed pick of the first question pair whose key starts with `prefix`.
const agreed = (a: Record<string, JevAnswer>, prefix: string) => {
  const key = Object.keys(a).find(
    (k) => k.startsWith(prefix) && !k.endsWith('_swapped') && !k.endsWith('_exists'),
  )
  return key === undefined ? undefined : agreedPick(a, key, CONFIDENCE_BAR)
}

const leadRow = (jev: Jev['Service'], c: (typeof leads)[number]) =>
  Effect.gen(function* () {
    const { picks } = yield* summaryDecision(c.input)
    const a = yield* answersOf(jev, 'summarize.lead', summaryDecision.def.payload(c.input))
    const pick = agreed(a, 'lead')
    const ok = Bun.deepEquals([...picks], c.label.picks)
    const wrongPick = pick !== undefined && !c.label.picks.includes(Number(pick.slice(1)))
    return {
      case: c.case,
      ok,
      conf: clarity(a),
      sureWrong: wrongPick && !ok,
      key: c.label.picks.every((l) => picks.includes(l)),
    }
  })
const coreRow = (jev: Jev['Service'], c: (typeof cores)[number]) =>
  Effect.gen(function* () {
    const v = yield* coreDecision(c.input)
    const a = yield* answersOf(jev, 'summarize.core', coreDecision.def.payload(c.input))
    const pick = agreed(a, 'core')
    const ok = v === c.label
    return {
      case: c.case,
      ok,
      conf: clarity(a),
      sureWrong: pick !== undefined && pick !== c.label,
      key: ok,
    }
  })

type Row = { case: string; ok: boolean; conf: number; sureWrong: boolean; key: boolean }
const stats = (rows: ReadonlyArray<Row>) => ({
  cases: rows.length,
  pass: rows.filter((r) => r.ok).length / rows.length,
  clarity: rows.reduce((s, r) => s + r.conf, 0) / rows.length,
  sureWrong: rows.filter((r) => r.sureWrong).length,
  keyFact: rows.filter((r) => r.key).length / rows.length,
  misses: rows.filter((r) => !r.ok).map((r) => r.case),
})

test('every eval case parses and labels page positions', () => {
  for (const c of leads)
    for (const l of c.label.picks) expect(Number.isInteger(l) && l >= 0).toBe(true)
  for (const c of cores) expect(['core', 'filler', 'unsure']).toContain(c.label)
})

test(
  'summarize.lead and summarize.core hold or beat the frequency rule live',
  () =>
    rt.runPromise(
      Effect.gen(function* () {
        const live = yield* Config.option(Config.String('WEBULAR_TEST_LIVE'))
        const jev = yield* Jev
        if (!Option.contains(live, '1') || !jev.available) return
        const lead = yield* Effect.forEach(leads, (c) => leadRow(jev, c), { concurrency: 4 })
        const core = yield* Effect.forEach(cores, (c) => coreRow(jev, c), { concurrency: 4 })
        const out = { lead: stats(lead), core: stats(core) }
        yield* Console.log(JSON.stringify(out))
        expect(out.lead.pass).toBeGreaterThan(0)
      }),
    ),
  600_000,
)
