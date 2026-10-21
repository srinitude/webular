// Loads one frozen, versioned task file. It refuses the file unless every
// manifest.json hash matches, the set is frozen, the canary is there, and every
// task has tags, a grader, and verifiable gold (spec-integrity-and-report.md,
// "Freeze before running" and guard tests 1, 2, 4, 5).
import { Effect, FileSystem, Schema } from 'effect'
import { BenchError } from './peers/model.ts'
import { type Check, Manifest, SetTask, type Task, TaskFile } from './schema.ts'

const refuse = (message: string) => Effect.fail(new BenchError({ message }))

export const sha256 = (text: string) => new Bun.CryptoHasher('sha256').update(text).digest('hex')

// An ISO 8601 date (YYYY-MM-DD) or full UTC timestamp that names a real day.
const isIso = (s: string) => {
  const d = new Date(s)
  return !Number.isNaN(d.getTime()) && [d.toISOString(), d.toISOString().slice(0, 10)].includes(s)
}

const blank = (s: string) => s.trim() === ''
const emptyCheck = (c: Check) => typeof c.value === 'string' && blank(c.value)

// Every reason one task cannot be graded fairly; empty when it is fine.
export const taskProblems = (t: Task): string[] => {
  const rules: ReadonlyArray<readonly [boolean, string]> = [
    [blank(t.tags.domain), 'empty tags.domain'],
    [blank(t.tags.language), 'empty tags.language'],
    [t.checks.length === 0 && blank(t.rubric ?? ''), 'no check and no rubric'],
    [t.checks.some(emptyCheck), 'empty check'],
    [blank(t.source), 'gold has no source'],
    [!isIso(t.asOf), `asOf is not ISO 8601: ${t.asOf}`],
    [!isIso(t.buildDate), `buildDate is not ISO 8601: ${t.buildDate}`],
    [t.aliases.length === 0, 'gold has no aliases'],
    [blank(t.author), 'gold has no author'],
    [blank(t.questionType), 'gold has no question type'],
  ]
  return rules.filter(([bad]) => bad).map(([, why]) => `${t.id}: ${why}`)
}

export const fileProblems = (file: TaskFile): string[] => [
  ...(file.frozen ? [] : ['set is not frozen']),
  ...(blank(file.canary) ? ['no canary'] : []),
  ...file.tasks.flatMap(taskProblems),
]

const readManifest = (fs: FileSystem.FileSystem, dir: string) =>
  fs.readFileString(`${dir}/manifest.json`).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(Manifest))),
    Effect.mapError((e) => new BenchError({ message: `manifest.json: ${String(e)}` })),
  )

const differs = (fs: FileSystem.FileSystem, path: string, want: string) =>
  fs.readFileString(path).pipe(
    Effect.map((text) => sha256(text) !== want),
    Effect.orElseSucceed(() => true),
  )

// Paths in manifest.json whose file is missing or whose sha256 differs.
export const manifestMismatches = (dir: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const manifest = yield* readManifest(fs, dir)
    const entries = Object.entries(manifest.files)
    const flags = yield* Effect.forEach(entries, ([p, want]) => differs(fs, `${dir}/${p}`, want), {
      concurrency: 8,
    })
    return { manifest, mismatches: entries.filter((_, i) => flags[i]).map(([p]) => p) }
  })

export const loadTaskFile = (dir: string, name: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const { manifest, mismatches } = yield* manifestMismatches(dir)
    if (!(name in manifest.files)) return yield* refuse(`${name}: not in manifest.json`)
    if (mismatches.length > 0) {
      return yield* refuse(`sha256 differs from manifest.json: ${mismatches.join(', ')}`)
    }
    const file = yield* fs.readFileString(`${dir}/${name}`).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(TaskFile))),
      Effect.mapError((e) => new BenchError({ message: `${name}: ${String(e)}` })),
    )
    const problems = fileProblems(file)
    if (problems.length > 0) return yield* refuse(`${name}: ${problems.join('; ')}`)
    return file
  })

// A JSONL set as lines: a { canary } header, then one SetTask per line.
const SetHeader = Schema.fromJsonString(Schema.Struct({ canary: Schema.String }))
const SetLines = Schema.Tuple([SetHeader, Schema.Array(Schema.fromJsonString(SetTask))])
const decodeSet = Schema.decodeUnknownEffect(SetLines)

// Loads one generated JSONL set (bench/tasks/<split>/<name>.jsonl) after the
// same manifest.json hash check; every task must carry the header's canary.
export const loadSetFile = (dir: string, name: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const { manifest, mismatches } = yield* manifestMismatches(dir)
    if (!(name in manifest.files)) return yield* refuse(`${name}: not in manifest.json`)
    if (mismatches.length > 0) {
      return yield* refuse(`sha256 differs from manifest.json: ${mismatches.join(', ')}`)
    }
    const [head = '', ...lines] = (yield* fs.readFileString(`${dir}/${name}`)).trimEnd().split('\n')
    const [{ canary }, tasks] = yield* decodeSet([head, lines]).pipe(
      Effect.mapError((e) => new BenchError({ message: `${name}: ${String(e)}` })),
    )
    const off = tasks.filter((t) => t.canary !== canary).map((t) => t.id)
    if (blank(canary) || off.length > 0) return yield* refuse(`${name}: canary missing on ${off}`)
    return { canary, tasks }
  })
