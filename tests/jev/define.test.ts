// CI rules for defineDecision: every declared decision has a labeled eval file whose
// baseline cases hold, was validated against the committed docs snapshot, builds a
// payload inside the docs limits, and lists its split in the decision-models-first
// decomposition shape. A lint fails on any Jev call made outside the definer.
import { expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, Schema } from 'effect'
import { JEV_MODEL_DEFAULT } from '../../src/lib/jev/client.ts'
import { decisions } from '../../src/lib/jev/decisions.ts'
import { type DecisionDef, defineDecision } from '../../src/lib/jev/define.ts'
import { committedSnapshot, violations } from '../../src/lib/jev/docs-guard.ts'
import { fetchBlockDecision, fetchErrorDecision } from '../../src/lib/jev/fetch.ts'
import { fetchBrowserDecision } from '../../src/lib/jev/fetch-browser.ts'
import { nextEvent } from '../../src/lib/jev/machine.ts'
import { CONFIDENCE_BAR, requestBytes } from '../../src/lib/jev/payload/index.ts'

const root = `${import.meta.dir}/../..`
type Built = { state: Record<string, unknown>; questions: object }
// The erased view CI needs: build a payload and run the fallback on eval input.
interface Declared {
  readonly def: Pick<
    DecisionDef<never, unknown>,
    'name' | 'subtasks' | 'bar' | 'evals' | 'docs'
  > & {
    readonly payload: (i: never) => Built
    readonly sample: () => unknown
    readonly fallback: (i: never) => unknown
  }
}
const DECLARED: ReadonlyArray<Declared> = [
  decisions.link,
  decisions.map,
  decisions.change,
  decisions.researchPart,
  decisions.extract,
  decisions.feed,
  decisions.summary,
  decisions.main,
  decisions.searchRank,
  decisions.searchIntent,
  decisions.cliSuggest,
  decisions.pageTitle,
  decisions.act,
  decisions.answerHits,
  decisions.answerSources,
  decisions.answerSentence,
  decisions.answerCitation,
  decisions.extractField,
  decisions.extractRecover,
  decisions.summaryCore,
  decisions.mapKind,
  fetchErrorDecision,
  fetchBlockDecision,
  fetchBrowserDecision,
  nextEvent,
]
const defs = DECLARED.map((d) => d.def)
const run = <A>(e: Effect.Effect<A, unknown, FileSystem.FileSystem>) =>
  Effect.runPromise(e.pipe(Effect.provide(BunServices.layer)))
const Case = Schema.Struct({ input: Schema.Unknown, label: Schema.Unknown })
const EvalFile = Schema.fromJsonString(
  Schema.Struct({
    decision: Schema.String,
    'baseline-wins': Schema.Array(Case),
    'baseline-loses': Schema.Array(Case),
  }),
)
const parseBody = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Unknown))
const build = (d: Declared['def']) => {
  const r = (d.payload as (i: unknown) => Built)(d.sample())
  return {
    body: requestBytes(JEV_MODEL_DEFAULT, r.state, r.questions as never),
    questions: r.questions as Record<string, { type?: string }>,
  }
}
const srcFiles = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const files = (yield* fs.readDirectory(`${root}/src`, { recursive: true })).filter((f) =>
    f.endsWith('.ts'),
  )
  const texts = yield* Effect.forEach(files, (f) => fs.readFileString(`${root}/src/${f}`), {
    concurrency: 16,
  })
  return files.map((f, i) => ({ file: f, text: texts[i] ?? '' }))
})
const checkEvals = (d: Declared['def']) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const e = Schema.decodeUnknownSync(EvalFile)(yield* fs.readFileString(`${root}/${d.evals}`))
    expect(e.decision).toBe(d.name)
    expect(e['baseline-wins'].length).toBeGreaterThan(0)
    expect(e['baseline-loses'].length).toBeGreaterThan(0)
    const fallback = d.fallback as (i: unknown) => unknown
    for (const c of e['baseline-wins'])
      expect([d.name, fallback(c.input)]).toEqual([d.name, c.label])
    for (const c of e['baseline-loses'])
      expect([d.name, Bun.deepEquals(fallback(c.input), c.label)]).toEqual([d.name, false])
    // Every case holds the input the payload builder reads; a mismatched case is a live-eval miss.
    for (const c of [...e['baseline-wins'], ...e['baseline-loses']])
      expect([d.name, typeof (d.payload as (i: unknown) => Built)(c.input).state]).toEqual([
        d.name,
        'object',
      ])
  })

test('every defineDecision call in src is declared here, once per name', () =>
  run(
    srcFiles.pipe(
      Effect.map((files) => {
        const calls = files
          .filter((f) => f.file !== 'lib/jev/define.ts')
          .reduce((n, f) => n + (f.text.match(/defineDecision</g) ?? []).length, 0)
        expect(calls).toBe(DECLARED.length)
        expect(new Set(defs.map((d) => d.name)).size).toBe(defs.length)
        return calls
      }),
    ),
  ))

test('each decision has an eval file with baseline-wins and baseline-loses cases that hold', () =>
  run(Effect.forEach(defs, checkEvals, { concurrency: 8 })))

test('each decision was validated against the committed docs snapshot, at the 0.95 bar', () => {
  for (const d of defs) {
    expect([d.name, d.docs]).toEqual([d.name, committedSnapshot.sha256])
    expect(d.bar).toBe(CONFIDENCE_BAR)
  }
})

test('each sample payload stays inside the limits read from the docs', () => {
  for (const d of defs) {
    const { body } = build(d)
    const broken = violations(parseBody(body), committedSnapshot.limits, body.length)
    expect([d.name, broken]).toEqual([d.name, []])
  }
})

test('each decision lists its subtasks in the decision-models-first decomposition shape', () => {
  const primitives = ['choice', 'score', 'noul']
  const patterns = ['fan-out', 'confidence-routing', 'composite-scoring', 'intent-routing', 'none']
  for (const d of defs) {
    const qs = build(d).questions
    for (const s of d.subtasks) {
      expect(Object.keys(s).sort()).toEqual(['name', 'pattern', 'payload', 'primitive'])
      expect(primitives).toContain(s.primitive)
      expect(patterns).toContain(s.pattern)
      expect([d.name, s.name, qs[s.payload.question]?.type]).toEqual([d.name, s.name, s.primitive])
    }
  }
})

test('Jev is called only through defineDecision', () =>
  run(
    srcFiles.pipe(
      Effect.map((files) => {
        const askers = files.filter((f) => /\.ask\(/.test(f.text)).map((f) => f.file)
        expect(askers).toEqual(['lib/jev/define.ts'])
        expect(files.filter((f) => /systemone/.test(f.text)).map((f) => f.file)).toEqual([
          'lib/jev/client.ts',
        ])
        return askers
      }),
    ),
  ))

// Typecheck proof: a decision missing a required field does not compile.
export const missingFields = () =>
  // @ts-expect-error evals, docs, codeCheck, subtasks, and sample are required
  defineDecision<number, boolean>({
    name: 'x',
    payload: () => ({ state: {}, questions: {} }),
    read: () => undefined,
    bar: CONFIDENCE_BAR,
    fallback: () => false,
  })
