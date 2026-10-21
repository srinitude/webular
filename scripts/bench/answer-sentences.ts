// Eval for answer.sentences: do the sentences after the lead hold one that states
// the answer? Cases are real: the bench's known-answer questions and the page text
// peers fetched for them (bench/recordings), three pages per answer as the answer
// command fetches. A case stores only Jev's candidates, the summarizer's picks on
// the whole text, and the sentences that hold an answer string.
//   bun scripts/bench/answer-sentences.ts cases    -> writes tests/jev/evals/answer.sentences.json
//   bun scripts/bench/answer-sentences.ts base|jev -> one run: pass rate (+ Jev clarity)
// Run each arm in a fresh process: the Jev client caches answers in memory.
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Console, Effect, FileSystem, Layer, Schema } from 'effect'
import { Jev } from '../../src/lib/jev/client.ts'
import { answerSentences } from '../../src/lib/jev/decisions/answer.ts'
import {
  answerCandidates,
  answerFollowers,
} from '../../src/lib/jev/decisions/answer-sentences.ts'
import { summarizeText } from '../../src/lib/summarize.ts'
import { builtinTasks } from './peers/tasks.ts'

const EVALS = 'tests/jev/evals/answer.sentences.json'
const SENTENCES = 3 // the answer command's default sentences
const FOLLOW = SENTENCES - 1 // the lead takes one slot
const PAGES = 3 // the answer command's default sources
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
  input: Schema.Struct({ question: Schema.String, candidates: Schema.Array(Schema.String) }),
  label: Schema.Array(Schema.Number),
  needed: Schema.Array(Schema.String),
  base: Schema.Array(Schema.String),
})
type Case = typeof CaseSchema.Type
const Evals = Schema.fromJsonString(
  Schema.Struct({
    'baseline-wins': Schema.Array(CaseSchema),
    'baseline-loses': Schema.Array(CaseSchema),
    neither: Schema.Array(CaseSchema),
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
// A page is a search hit for a question when it holds 60% of its content words.
const onTopic = (question: string, text: string) => {
  const want = words(question)
  return want.filter((w) => norm(text).includes(w)).length >= Math.max(2, 0.6 * want.length)
}
// Sentences are cut to what Jev sees, which keeps the file small; equality still holds.
const cut = (xs: ReadonlyArray<string>) => xs.map((s) => s.slice(0, 600))
// One answer over `pages`: Jev's candidates stand in for the whole text.
const caseFor = (question: string, answers: ReadonlyArray<string>, pages: ReadonlyArray<string>) => {
  const full = pages.join('\n\n')
  const all = answerSentences(full)
  const needed = cut(all.filter((s) => answers.some((a) => norm(s).includes(norm(a)))))
  if (needed.length === 0 || all.length < 5) return []
  const candidates = cut(answerCandidates(question, full))
  const base = cut(summarizeText(full, SENTENCES).sentences)
  const label = candidates.flatMap((s, i) => (needed.includes(s) ? [i] : []))
  return [{ input: { question, candidates }, label, needed, base }]
}
// The follower sentences, as answer.ts builds them: kept ones first, then the summarizer.
const follow = (c: Case, kept: ReadonlyArray<number>) =>
  [...new Set([...kept.map((i) => c.input.candidates[i] ?? ''), ...c.base])].slice(0, FOLLOW)
const passes = (c: Case, chosen: ReadonlyArray<string>) => chosen.some((s) => c.needed.includes(s))
const basePasses = (c: Case) => passes(c, follow(c, []))

const buildCases = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const pages = new Map<string, string>()
  for (const f of yield* fs.readDirectory('bench/recordings')) {
    const rec = yield* Schema.decodeUnknownEffect(Citations)(
      yield* fs.readFileString(`bench/recordings/${f}`),
    )
    for (const c of rec.output?.citations ?? []) if (c.text) pages.set(c.url, c.text)
  }
  const cases = builtinTasks
    .filter((t) => t.answers !== undefined)
    .flatMap((t) => {
      const q = String(t.input.query)
      const hits = [...pages.values()].filter((p) => onTopic(q, p))
      return hits.flatMap((_, i) =>
        i + PAGES > hits.length ? [] : caseFor(q, t.answers ?? [], hits.slice(i, i + PAGES)),
      )
    })
  const body = {
    decision: 'answer.sentences',
    'baseline-wins': cases.filter(basePasses).map((c) => ({ ...c, label: [] })),
    'baseline-loses': cases.filter((c) => !basePasses(c) && c.label.length > 0),
    neither: cases.filter((c) => !basePasses(c) && c.label.length === 0),
  }
  yield* fs.writeFileString(EVALS, `${JSON.stringify(body, null, 2)}\n`)
  return `cases ${cases.length}: wins ${body['baseline-wins'].length}, neither ${body.neither.length}`
})

const readCases = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const raw = yield* Schema.decodeUnknownEffect(Evals)(yield* fs.readFileString(EVALS))
  return [...raw['baseline-wins'], ...raw['baseline-loses'], ...raw.neither]
})

// Clarity: conf is how sure the `any` noul is (distance from a coin flip, 0..1);
// sure means Jev kept sentences at the bar; wrong means none of them holds the answer.
const clarity = (c: Case, a: Record<string, unknown>) => {
  const any = (a['any'] as { readonly noul?: number } | undefined)?.noul ?? 0.5
  const kept = answerFollowers.def.read(a as never, 0.95, c.input)
  const right = kept?.some((i) => c.needed.includes(c.input.candidates[i] ?? '')) ?? false
  return { conf: Math.abs(any - 0.5) * 2, sure: kept !== undefined, right }
}
const jevArm = (cases: ReadonlyArray<Case>) =>
  Effect.forEach(
    cases,
    (c) =>
      Effect.gen(function* () {
        const jev = yield* Jev
        const r = yield* jev.ask('answer.sentences', answerFollowers.def.payload(c.input))
        const kept = yield* answerFollowers(c.input)
        return { pass: passes(c, follow(c, kept)), ...clarity(c, r.answers) }
      }),
    { concurrency: 4 },
  )

const mean = (xs: ReadonlyArray<number>) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length)
const sd = (xs: ReadonlyArray<number>) =>
  Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2)) * (xs.length / Math.max(1, xs.length - 1)))
type Row = { pass: boolean; conf: number; sure: boolean; right: boolean }
const bit = (b: boolean) => (b ? 1 : 0)
const se = (xs: ReadonlyArray<number>) => sd(xs) / Math.sqrt(xs.length)
const report = (rows: ReadonlyArray<Row>) =>
  JSON.stringify({
    n: rows.length,
    pass: mean(rows.map((r) => bit(r.pass))),
    passSE: se(rows.map((r) => bit(r.pass))),
    conf: mean(rows.map((r) => r.conf)),
    confSE: se(rows.map((r) => r.conf)),
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
  return JSON.stringify({ n: cases.length, pass: mean(pass), passSE: se(pass) })
})

BunRuntime.runMain(
  main.pipe(
    Effect.flatMap(Console.log),
    Effect.provide(Layer.mergeAll(BunServices.layer, Jev.live)),
  ),
)
