// Prints the spec quotas that span families (answer ambiguity, answer premise,
// fresh counts) over dev, test, and the local private split, and checks them.
import { expect, test } from 'bun:test'
import { Console, Effect, Schema } from 'effect'

const root = `${import.meta.dir}/../../..`
const decodeLine = Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Unknown))

type Row = {
  readonly family: string
  readonly questionType?: string
  readonly input: { readonly subtype?: string }
  readonly tags: { readonly ambiguous?: boolean; readonly premise?: string }
}

const readFile = (path: string) =>
  Effect.gen(function* () {
    const file = Bun.file(path)
    if (!(yield* Effect.tryPromise(() => file.exists()))) return []
    const lines = (yield* Effect.tryPromise(() => file.text())).trimEnd().split('\n').slice(1)
    return (yield* Effect.forEach(lines, (l) => decodeLine(l), {
      concurrency: 1,
    })) as ReadonlyArray<Row>
  })

const rowsOf = (name: string) =>
  Effect.forEach(
    ['dev', 'test', 'private'],
    (s) => readFile(`${root}/bench/tasks/${s}/${name}.jsonl`),
    {
      concurrency: 3,
    },
  ).pipe(Effect.map((x) => x.flat()))

// Logs a quota line and returns its label when the quota is missed.
const line = (label: string, have: number, need: number) =>
  Console.log(`quota ${label}: ${have} of ${need} ${have >= need ? 'met' : 'NOT met'}`).pipe(
    Effect.as(have >= need ? [] : [label]),
  )

// The private split lives only on the machine that built it (git ignores it),
// and these quotas count the whole set, so they skip on a clean checkout.
// Bun.file(...).size is 0 for a missing file and is known before tests are declared.
const hasPrivate = Bun.file(`${root}/bench/tasks/private/answer.jsonl`).size > 0
const noPrivate = hasPrivate ? '' : ' (skipped: bench/tasks/private/answer.jsonl is missing)'

test.skipIf(!hasPrivate)(`cross-family quotas${noPrivate}`, () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const fresh = yield* rowsOf('fresh')
      const answer = [...(yield* rowsOf('answer')), ...fresh.filter((r) => r.family === 'answer')]
      const subtype = (r: Row) => r.input.subtype ?? r.questionType
      const count = (rows: ReadonlyArray<Row>, s: string) =>
        rows.filter((r) => subtype(r) === s).length
      const ambiguous = answer.filter((r) => r.tags.ambiguous === true).length
      const premise = answer.filter(
        (r) => r.tags.premise === 'false' || r.tags.premise === 'no-answer',
      ).length
      const misses = yield* Effect.all(
        [
          line('answer total', answer.length, 330),
          line('answer.no-answer', count(answer, 'answer.no-answer'), 30),
          line('answer ambiguous (10%)', ambiguous, Math.ceil(answer.length * 0.1)),
          line('answer premise (20%)', premise, Math.ceil(answer.length * 0.2)),
          line('search.fresh', count(fresh, 'search.fresh'), 60),
          line('answer.short fresh', count(fresh, 'answer.short'), 66),
        ],
        { concurrency: 1 },
      )
      expect(misses.flat()).toEqual([])
    }),
  ))
