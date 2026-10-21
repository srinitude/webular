// Recordings: one JSON file per row, keyed by provider, task, run, commit,
// settings hash, and date (audit finding 13, guard tests 13 and 14).
import { Data, Effect, FileSystem, Path, Schema } from 'effect'
import { type RecordingKey, Row } from './schema.ts'

export class RecordingError extends Data.TaggedError('RecordingError')<{
  readonly message: string
}> {}

const COMMIT = /^[0-9a-f]{7,40}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

export const keyProblems = (key: RecordingKey): string[] => [
  ...(COMMIT.test(key.commit) ? [] : ['commit missing or not a git sha']),
  ...(key.settingsHash === '' ? ['settings hash missing'] : []),
  ...(DATE.test(key.date) ? [] : ['date missing or not YYYY-MM-DD']),
  ...(key.provider === '' || key.taskId === '' ? ['provider or task missing'] : []),
]

export const recordingName = ({ key: k, settings, phase }: Row) =>
  `${k.provider}/${k.taskId}.${k.run}.${k.commit}.${k.settingsHash}.${k.date}.${settings}-${phase}.json`

const fail = (message: string) => Effect.fail(new RecordingError({ message }))

export const writeRecording = (dir: string, row: Row) =>
  Effect.gen(function* () {
    const problems = keyProblems(row.key)
    if (problems.length > 0) return yield* fail(`bad recording key: ${problems.join(', ')}`)
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const file = path.join(dir, recordingName(row))
    yield* fs.makeDirectory(path.dirname(file), { recursive: true })
    yield* fs.writeFileString(file, `${JSON.stringify(row)}\n`)
  })

const decodeRow = (file: string, text: string) =>
  Effect.try({ try: () => JSON.parse(text) as unknown, catch: () => new Error('bad JSON') }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(Row)),
    Effect.mapError((e) => new RecordingError({ message: `${file}: ${e.message}` })),
  )

// Reads every recording under dir; refuses any whose key is incomplete.
export const readRecordings = (dir: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const names = (yield* fs.readDirectory(dir, { recursive: true }))
      .filter((n) => n.endsWith('.json'))
      .toSorted()
    const rows = yield* Effect.forEach(
      names,
      (n) => fs.readFileString(path.join(dir, n)).pipe(Effect.flatMap((t) => decodeRow(n, t))),
      { concurrency: 8 },
    )
    const bad = rows.flatMap((r) => keyProblems(r.key).map((p) => `${recordingName(r)}: ${p}`))
    if (bad.length > 0) return yield* fail(bad.join('\n'))
    return rows
  })

// Same row set: every provider has the same task, run, settings, and phase
// cells and the same round window; a missing cell fails the comparison.
const cell = (r: Row) => `${r.key.taskId}|${r.key.run}|${r.settings}|${r.phase}|${r.round}`

export const rowSetProblems = (rows: ReadonlyArray<Row>): string[] => {
  const byProvider = Map.groupBy(rows, (r) => r.key.provider)
  const all = new Set(rows.map(cell))
  return [...byProvider].flatMap(([provider, own]) => {
    const have = new Set(own.map(cell))
    return [...all].filter((c) => !have.has(c)).map((c) => `${provider}: missing row ${c}`)
  })
}
