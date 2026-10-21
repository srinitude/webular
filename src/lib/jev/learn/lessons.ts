// Lessons: payload changes that proved better on held-out eval cases. A lesson
// is kept only when held-out accuracy holds or rises AND mean confidence rises;
// the recorder applies kept lessons to every payload of that decision at once.
// Proposals are deterministic payload transforms. Option order is not one:
// `canonical` sorts keys, so Jev always sees one fixed order.
import { Effect, type FileSystem, Option, Schema } from 'effect'
import type { JevAnswer, JevQuestion, JevRequest, JevResult } from '../client.ts'
import type { JevError } from '../errors.ts'
import { confidenceOf, DATA_ONLY, instructionText } from '../payload/index.ts'

const LESSON_KINDS = ['structured-options', 'data-only'] as const
type LessonKind = (typeof LESSON_KINDS)[number]
interface Score {
  readonly accuracy: number
  readonly confidence: number
  readonly cases: number
}
interface Lesson {
  readonly kind: LessonKind
  readonly before: Score
  readonly after: Score
}
export type LessonBook = Record<string, ReadonlyArray<Lesson>>

const what = <V>(v: V | string | null, k: string) =>
  v === null ? { what: k } : typeof v === 'string' ? { what: v } : v
// Choice options and Score levels become {what} objects, as the docs advise.
const structured = (q: JevQuestion): JevQuestion =>
  q.type === 'choice'
    ? {
        ...q,
        criteria: Object.fromEntries(Object.entries(q.criteria).map(([k, v]) => [k, what(v, k)])),
      }
    : q.type === 'score'
      ? { ...q, criteria: q.criteria.map((v, i) => what(v, `level ${i}`)) }
      : q
const withRule = ({ instructions: i }: JevQuestion) =>
  typeof i === 'string' ? `${i} ${DATA_ONLY}` : { ...i, rules: [...(i.rules ?? []), DATA_ONLY] }
const dataOnly = (q: JevQuestion): JevQuestion =>
  /as data/i.test(instructionText(q.instructions)) ? q : { ...q, instructions: withRule(q) }

const TRANSFORMS: Record<LessonKind, (q: JevQuestion) => JevQuestion> = {
  'structured-options': structured,
  'data-only': dataOnly,
}
const reshape = (q: JevQuestion, kinds: ReadonlyArray<LessonKind>) =>
  kinds.reduce((acc, kind) => TRANSFORMS[kind](acc), q)

export const applyLessons = (req: JevRequest, kinds: ReadonlyArray<LessonKind>): JevRequest =>
  kinds.length === 0
    ? req
    : {
        state: req.state,
        questions: Object.fromEntries(
          Object.entries(req.questions).map(([k, q]) => [k, reshape(q, kinds)]),
        ),
      }

const parseJson = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Unknown))

const readJson = <A>(fs: FileSystem.FileSystem, path: string, empty: A) =>
  fs.readFileString(path).pipe(
    Effect.map((s) => Option.getOrElse(parseJson(s), () => empty) as A),
    Effect.orElseSucceed(() => empty),
  )
export const readLessons = (fs: FileSystem.FileSystem, path: string) =>
  readJson<LessonBook>(fs, path, {})
export const writeLessons = (fs: FileSystem.FileSystem, path: string, book: LessonBook) =>
  fs.writeFileString(path, `${JSON.stringify(book, null, 2)}\n`)

// JSON lines, skipping blank or broken ones.
export const parseRows = <A>(text: string): A[] =>
  text.split('\n').flatMap((l) => Option.toArray(parseJson(l)) as A[])
export const readRows = <A>(fs: FileSystem.FileSystem, path: string) =>
  fs.readFileString(path).pipe(
    Effect.map((s) => parseRows<A>(s)),
    Effect.orElseSucceed(() => [] as A[]),
  )

// ── learning ──
export interface EvalCase {
  readonly input?: unknown
  readonly label: string
  readonly callId?: string
}
export interface Learnable<I> {
  readonly name: string
  readonly payload: (input: I) => JevRequest
  readonly read: (answers: Record<string, JevAnswer>) => string | undefined
}
type Ask = (decision: string, req: JevRequest) => Effect.Effect<JevResult, JevError>

// Every third case is held out; under three cases, all are held out.
const heldOut = <A>(cases: ReadonlyArray<A>) =>
  cases.length < 3 ? cases : cases.filter((_, i) => i % 3 === 2)

const minConfidence = (answers: Record<string, JevAnswer>) => {
  const as = Object.values(answers)
  return as.length ? Math.min(...as.map((a) => confidenceOf(a))) : 0
}

const scoreOn = <I>(
  ask: Ask,
  d: Learnable<I>,
  cases: ReadonlyArray<EvalCase>,
  kinds: ReadonlyArray<LessonKind>,
) =>
  Effect.forEach(
    cases,
    (c) =>
      ask(d.name, applyLessons(d.payload(c.input as I), kinds)).pipe(
        Effect.map((r) => ({ ok: d.read(r.answers) === c.label, conf: minConfidence(r.answers) })),
        Effect.orElseSucceed(() => ({ ok: false, conf: 0 })),
      ),
    { concurrency: 4 },
  ).pipe(
    Effect.map(
      (rs): Score => ({
        accuracy: rs.length ? rs.filter((r) => r.ok).length / rs.length : 0,
        confidence: rs.length ? rs.reduce((s, r) => s + r.conf, 0) / rs.length : 0,
        cases: rs.length,
      }),
    ),
  )

const keeps = (before: Score, after: Score) =>
  after.cases > 0 && after.accuracy >= before.accuracy && after.confidence > before.confidence

// Tries each lesson kind missing from `kept`, on held-out cases with an input,
// through `ask` (the replay-backed Jev, so recorded fixtures answer for free).
export const learnDecision = <I>(
  ask: Ask,
  d: Learnable<I>,
  cases: ReadonlyArray<EvalCase>,
  kept: ReadonlyArray<Lesson>,
) =>
  Effect.gen(function* () {
    const test = heldOut(cases.filter((c) => c.input !== undefined))
    const out = [...kept]
    const untried = LESSON_KINDS.filter((kind) => !kept.some((l) => l.kind === kind))
    for (const kind of untried) {
      const base = out.map((l) => l.kind)
      const before = yield* scoreOn(ask, d, test, base)
      const after = yield* scoreOn(ask, d, test, [...base, kind])
      if (keeps(before, after)) out.push({ kind, before, after })
    }
    return out
  })

// ── log summary and corrections ──
interface DecisionStats {
  readonly calls: number
  readonly fallbackRate: number
  readonly meanConfidence: number
}
interface StatRow {
  readonly decision: string
  readonly fallback: boolean
  readonly confidence: number | null
}
const bump = (s: { n: number; fb: number; conf: number }, r: StatRow) => ({
  n: s.n + 1,
  fb: s.fb + (r.fallback ? 1 : 0),
  conf: s.conf + (r.confidence ?? 0),
})
export const summarize = (rows: ReadonlyArray<StatRow>): Record<string, DecisionStats> => {
  const by = new Map<string, { n: number; fb: number; conf: number }>()
  for (const r of rows) by.set(r.decision, bump(by.get(r.decision) ?? { n: 0, fb: 0, conf: 0 }, r))
  return Object.fromEntries(
    [...by].map(([k, s]) => [
      k,
      { calls: s.n, fallbackRate: s.fb / s.n, meanConfidence: s.conf / s.n },
    ]),
  )
}

export const evalsPath = (dir: string, decision: string) =>
  `${dir}/${decision.replace(/[^\w.-]/g, '_')}.jsonl`

// A user correction becomes a labeled eval case for that call's decision.
export const correct = (
  fs: FileSystem.FileSystem,
  rows: ReadonlyArray<{ id: string; decision: string; payloadHash: string }>,
  evalsDir: string,
  call: { readonly id: string; readonly label: string; readonly input?: unknown },
) =>
  Effect.gen(function* () {
    const row = rows.find((r) => r.id === call.id)
    if (row === undefined) return yield* Effect.fail(`no recorded Jev call ${call.id}`)
    const extra = call.input === undefined ? {} : { input: call.input }
    const c = { callId: call.id, label: call.label, payloadHash: row.payloadHash, ...extra }
    const path = evalsPath(evalsDir, row.decision)
    yield* fs.makeDirectory(evalsDir, { recursive: true }).pipe(
      Effect.andThen(fs.writeFileString(path, `${JSON.stringify(c)}\n`, { flag: 'a' })),
      Effect.mapError((e) => String(e)),
    )
    return { path, decision: row.decision }
  })
