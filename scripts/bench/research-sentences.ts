// Eval for research.sentences: does each source's report section hold a sentence
// that states the answer? Cases are real: the bench's known-answer questions and
// the page text peers fetched for them (bench/recordings). A case lists the
// sentences that hold an answer string.
//   bun scripts/bench/research-sentences.ts cases    -> writes tests/jev/evals/research.sentences.json
//   bun scripts/bench/research-sentences.ts base|jev -> one run: pass rate (+ Jev clarity)
// Run each arm in a fresh process: the Jev client caches answers in memory.
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Console, Effect, FileSystem, Layer, Schema } from 'effect'
import { Jev } from '../../src/lib/jev/client.ts'
import { answerSentences } from '../../src/lib/jev/decisions/answer.ts'
import { researchSentence } from '../../src/lib/jev/decisions/research-sentences.ts'
import { summarizeText } from '../../src/lib/summarize.ts'
import { builtinTasks } from './peers/tasks.ts'

const EVALS = 'tests/jev/evals/research.sentences.json'
const TOP_N = 2 // the research command's default sentences per source
const Citations = Schema.fromJsonString(
  Schema.Struct({
    output: Schema.optional(
      Schema.Struct({
        citations: Schema.optional(
          Schema.Array(Schema.Struct({ url: Schema.String, text: Schema.optional(Schema.String) })),
        ),
      }),
    ),
  }),
)
const CaseSchema = Schema.Struct({
  input: Schema.Struct({ topic: Schema.String, text: Schema.String }),
  label: Schema.Array(Schema.Number),
  needed: Schema.Array(Schema.Number),
})
type Case = typeof CaseSchema.Type
const Evals = Schema.fromJsonString(
  Schema.Struct({
    'baseline-wins': Schema.Array(CaseSchema),
    'baseline-loses': Schema.Array(CaseSchema),
  }),
)
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
const STOP = new Set(['which', 'what', 'were', 'does', 'according', 'city', 'novel', 'born'])
const words = (s: string) =>
  norm(s)
    .split(' ')
    .filter((w) => w.length > 3 && !STOP.has(w))

// A page belongs to a question when it holds an answer string and 60% of its content words.
const caseFor = (topic: string, answers: ReadonlyArray<string>, text: string) => {
  const t = norm(text)
  const want = words(topic)
  if (want.filter((w) => t.includes(w)).length < Math.max(2, 0.6 * want.length)) return []
  const all = answerSentences(text)
  const needed = all.flatMap((s, i) => (answers.some((a) => norm(s).includes(norm(a))) ? [i] : []))
  if (needed.length === 0 || all.length < 5) return []
  // The label is the fallback's pick when it is a needed sentence, else the first needed one.
  const lead = researchSentence.def.fallback({ topic, text })
  const label = needed.includes(lead[0] ?? -1) ? lead : [needed[0] ?? 0]
  return [{ input: { topic, text }, label, needed }]
}
const leadWins = (c: Case) => Bun.deepEquals(researchSentence.def.fallback(c.input), c.label)
// The section's sentences, as research.ts builds them: kept ones first, then the summarizer.
const picks = (c: Case, kept: ReadonlyArray<number>) => {
  const top = summarizeText(c.input.text, TOP_N, { query: c.input.topic }).sentences
  const all = answerSentences(c.input.text)
  return [...new Set([...kept.map((i) => all[i] ?? ''), ...top])].slice(0, TOP_N)
}
const passes = (c: Case, chosen: ReadonlyArray<string>) => {
  const all = answerSentences(c.input.text)
  return c.needed.some((i) => chosen.includes(all[i] ?? '\u0000'))
}
const basePasses = (c: Case) => passes(c, picks(c, []))

const buildCases = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const pages = new Map<string, string>()
  for (const f of yield* fs.readDirectory('bench/recordings')) {
    const raw = yield* fs.readFileString(`bench/recordings/${f}`)
    const rec = yield* Schema.decodeUnknownEffect(Citations)(raw)
    for (const c of rec.output?.citations ?? []) if (c.text) pages.set(c.url, c.text)
  }
  const qa = builtinTasks.filter((t) => t.answers !== undefined)
  const cases = qa.flatMap((t) =>
    [...pages.values()].flatMap((text) => caseFor(String(t.input.query), t.answers ?? [], text)),
  )
  const body = {
    decision: 'research.sentences',
    'baseline-wins': cases.filter(leadWins),
    'baseline-loses': cases.filter((c) => !leadWins(c)),
  }
  yield* fs.writeFileString(EVALS, `${JSON.stringify(body, null, 2)}\n`)
  return `cases ${cases.length}: baseline wins ${body['baseline-wins'].length}`
})

const readCases = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const raw = yield* Schema.decodeUnknownEffect(Evals)(yield* fs.readFileString(EVALS))
  return [...raw['baseline-wins'], ...raw['baseline-loses']]
})

// Clarity: conf is how sure the `any` noul is (distance from a coin flip, 0..1);
// sure means Jev kept sentences at the bar; wrong means none of them was needed.
const clarity = (c: Case, a: Record<string, unknown>) => {
  const any = (a['any'] as { readonly noul?: number } | undefined)?.noul ?? 0.5
  const kept = researchSentence.def.read(a as never, 0.95, c.input)
  const right = kept?.some((i) => c.needed.includes(i)) ?? false
  return { conf: Math.abs(any - 0.5) * 2, sure: kept !== undefined, right }
}

const jevArm = (cases: ReadonlyArray<Case>) =>
  Effect.forEach(
    cases,
    (c) =>
      Effect.gen(function* () {
        const jev = yield* Jev
        const r = yield* jev.ask('research.sentences', researchSentence.def.payload(c.input))
        const kept = yield* researchSentence(c.input)
        return { pass: passes(c, picks(c, kept)), ...clarity(c, r.answers) }
      }),
    { concurrency: 4 },
  )

const mean = (xs: ReadonlyArray<number>) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length)
const sd = (xs: ReadonlyArray<number>) =>
  Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2)) * (xs.length / Math.max(1, xs.length - 1)))
type Row = { pass: boolean; conf: number; sure: boolean; right: boolean }
const bit = (b: boolean) => (b ? 1 : 0)
const report = (rows: ReadonlyArray<Row>) =>
  JSON.stringify({
    n: rows.length,
    pass: mean(rows.map((r) => bit(r.pass))),
    passSE: sd(rows.map((r) => bit(r.pass))) / Math.sqrt(rows.length),
    conf: mean(rows.map((r) => r.conf)),
    confSE: sd(rows.map((r) => r.conf)) / Math.sqrt(rows.length),
    at95: mean(rows.map((r) => bit(r.sure))),
    sureRight: mean(rows.filter((r) => r.sure).map((r) => bit(r.right))),
    sureWrong: rows.filter((r) => r.sure && !r.right).length,
  })

const main = Effect.gen(function* () {
  const arm = process.argv[2]
  if (arm === 'cases') return yield* buildCases
  const cases = yield* readCases
  if (arm === 'jev') return report(yield* jevArm(cases))
  const pass = cases.map((c) => bit(basePasses(c)))
  return JSON.stringify({
    n: cases.length,
    pass: mean(pass),
    passSE: sd(pass) / Math.sqrt(cases.length),
  })
})

BunRuntime.runMain(
  main.pipe(
    Effect.flatMap(Console.log),
    Effect.provide(Layer.mergeAll(BunServices.layer, Jev.live)),
  ),
)
