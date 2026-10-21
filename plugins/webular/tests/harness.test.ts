// evals/harness.json maps every test name and every skill eval id to its
// grader, deterministic entries first. Files are read at run time, so a new
// test or eval id fails here until it is mapped.
import { expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, Schema } from 'effect'

const root = new URL('..', import.meta.url).pathname
// ponytail: regex scan of test( calls, one level of nested parens in a modifier
const testName = /\btest(?:\.\w+\((?:[^()]|\([^()]*\))*\))?\(\s*(['"`])(.+?)\1/g

const Entry = Schema.Struct({
  assertion: Schema.String,
  source: Schema.String,
  kind: Schema.Literals(['deterministic', 'jev']),
  grader: Schema.String,
})
const Harness = Schema.fromJsonString(Schema.Struct({ entries: Schema.Array(Entry) }))
const EvalIds = Schema.fromJsonString(
  Schema.Struct({ evals: Schema.Array(Schema.Struct({ id: Schema.String })) }),
)
const decodeHarness = Schema.decodeUnknownEffect(Harness)
const decodeEvalIds = Schema.decodeUnknownEffect(EvalIds)

const testNames = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const files = (yield* fs.readDirectory(`${root}tests`)).filter((f) => f.endsWith('.test.ts'))
  const texts = yield* Effect.forEach(files, (f) => fs.readFileString(`${root}tests/${f}`), {
    concurrency: 4,
  })
  return texts.flatMap((t) => [...t.matchAll(testName)].map((m) => m[2]))
})

const idsOf = (fs: FileSystem.FileSystem, path: string) =>
  fs.exists(path).pipe(
    Effect.flatMap((ok) =>
      ok
        ? fs.readFileString(path).pipe(Effect.flatMap(decodeEvalIds))
        : Effect.succeed({ evals: [] }),
    ),
    Effect.map((file) => file.evals.map((e) => e.id)),
  )

const evalIds = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const skills = yield* fs.readDirectory(`${root}skills`)
  const ids = yield* Effect.forEach(
    skills,
    (s) => idsOf(fs, `${root}skills/${s}/evals/evals.json`),
    {
      concurrency: 4,
    },
  )
  return ids.flat()
})

const harness = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  return (yield* decodeHarness(yield* fs.readFileString(`${root}evals/harness.json`))).entries
})

const run = <A>(body: Effect.Effect<A, unknown, FileSystem.FileSystem>) =>
  Effect.runPromise(body.pipe(Effect.provide(BunServices.layer)))

const unmapped = (
  names: Effect.Effect<ReadonlyArray<string | undefined>, unknown, FileSystem.FileSystem>,
) =>
  Effect.gen(function* () {
    const mapped = new Set((yield* harness).map((e) => e.assertion))
    return (yield* names).filter((n) => n !== undefined && !mapped.has(n))
  })

test('every test name in the tests folder has a harness entry', () =>
  run(unmapped(testNames).pipe(Effect.map((missing) => expect(missing).toEqual([])))))

test('every skill eval id has a harness entry', () =>
  run(unmapped(evalIds).pipe(Effect.map((missing) => expect(missing).toEqual([])))))

test('deterministic entries come before jev entries', () =>
  run(
    Effect.gen(function* () {
      const kinds = (yield* harness).map((e) => e.kind)
      const firstJev = kinds.indexOf('jev')
      expect(kinds.lastIndexOf('deterministic')).toBeLessThan(
        firstJev === -1 ? kinds.length : firstJev,
      )
    }),
  ))
