// Eval: the answer image arm against the text-only answer, offline. Each case
// carries the text answer the workflow gives, whether its lead pick cleared
// the 0.95 bar, and a recorded image.router answer. Prints pass rate and
// sure-but-wrong for both arms; the image arm must hold pass rate and not add
// sure-but-wrong answers.
import { expect, test } from 'bun:test'
import { Console, Effect, Layer } from 'effect'
import { answerFigure, figureNote, type LeadSource } from '../../src/lib/answer-figure.ts'
import { Jev, type JevResult } from '../../src/lib/jev/client.ts'
import cases from './candidates/answer.figure.json'

type Gold = { kind: 'text'; fact: string } | { kind: 'figure'; src: string }
type Case = {
  id: string
  question: string
  lead: LeadSource
  textAnswer: string
  leadSure: boolean
  router: { choice: string; confidence: number } | null
  gold: Gold
}
const all = [...cases['baseline-wins'], ...cases['baseline-loses']] as ReadonlyArray<Case>

// Recorded router answers; a case with no recording must not call Jev.
const recorded = (c: Case) =>
  Layer.succeed(Jev)(
    Jev.of({
      available: true,
      ask: () =>
        c.router === null
          ? Effect.die(`no Jev call expected for ${c.id}`)
          : Effect.succeed({
              answers: { route: c.router, route_swapped: c.router },
            } as unknown as JevResult),
    }),
  )

const correct = (gold: Gold, answer: string) =>
  gold.kind === 'text' ? answer.includes(gold.fact) : answer.includes(gold.src)

type Row = { ok: boolean; sure: boolean }
const textArm = (c: Case): Row => ({ ok: correct(c.gold, c.textAnswer), sure: c.leadSure })
const imageArm = (c: Case) =>
  answerFigure({ question: c.question, lead: c.lead }).pipe(
    Effect.provide(recorded(c)),
    Effect.map((f): Row => {
      const answer = f === undefined ? c.textAnswer : `${figureNote(f)} ${c.textAnswer}`
      // A figure answer never claims a sure text answer.
      return { ok: correct(c.gold, answer), sure: f === undefined && c.leadSure }
    }),
  )

const stats = (rows: ReadonlyArray<Row>) => ({
  pass: rows.filter((r) => r.ok).length / rows.length,
  sureWrong: rows.filter((r) => r.sure && !r.ok).length,
})

test('the text arm passes every baseline-wins case and fails every baseline-loses case', () => {
  for (const c of cases['baseline-wins'] as ReadonlyArray<Case>) expect(textArm(c).ok).toBe(true)
  for (const c of cases['baseline-loses'] as ReadonlyArray<Case>) expect(textArm(c).ok).toBe(false)
})

test('the image arm holds pass rate and adds no sure-but-wrong answer', () =>
  Effect.runPromise(
    Effect.forEach(all, imageArm).pipe(
      Effect.map((rows) => ({ before: stats(all.map(textArm)), after: stats(rows) })),
      Effect.tap((r) =>
        Console.log(JSON.stringify({ eval: 'answer.figure', cases: all.length, ...r })),
      ),
      Effect.tap(({ before, after }) =>
        Effect.sync(() => {
          expect(after.pass).toBeGreaterThanOrEqual(before.pass)
          expect(after.sureWrong).toBeLessThanOrEqual(before.sureWrong)
        }),
      ),
    ),
  ))
