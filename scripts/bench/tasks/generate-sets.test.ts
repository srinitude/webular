// Every committed task file: canary on the header and every row, and every
// row carries the fields the spec requires (source, date, aliases, tags).
import { expect, test } from 'bun:test'
import { BunFileSystem } from '@effect/platform-bun'
import { Effect, FileSystem, Schema } from 'effect'
import { CANARY } from './generate-common.ts'

const Row = Schema.Struct({
  id: Schema.String,
  family: Schema.String,
  split: Schema.Literals(['dev', 'test', 'private']),
  aliases: Schema.Array(Schema.String),
  source: Schema.Struct({ url: Schema.String, asOf: Schema.String, license: Schema.String }),
  author: Schema.String,
  buildDate: Schema.String,
  questionType: Schema.String,
  tags: Schema.Struct({ domain: Schema.String, language: Schema.String }),
  canary: Schema.Literal(CANARY),
})
const Header = Schema.Struct({ canary: Schema.Literal(CANARY) })
const root = `${import.meta.dir}/../../../bench/tasks`

const readSplit = (split: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const names = (yield* fs.readDirectory(`${root}/${split}`)).filter((n) => n.endsWith('.jsonl'))
    return yield* Effect.forEach(
      names,
      (name) =>
        fs
          .readFileString(`${root}/${split}/${name}`)
          .pipe(Effect.map((text) => ({ name, lines: text.trim().split('\n') }))),
      { concurrency: 4 },
    )
  })

const decode = (schema: typeof Row | typeof Header, line: string) =>
  Schema.decodeUnknownEffect(Schema.fromJsonString(schema))(line)

test('dev and test rows carry the canary and every required field', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const files = [...(yield* readSplit('dev')), ...(yield* readSplit('test'))]
      expect(files.length).toBeGreaterThan(0)
      for (const { lines } of files) {
        yield* decode(Header, lines[0] ?? '')
        yield* Effect.forEach(lines.slice(1), (line) => decode(Row, line), {
          concurrency: 1,
          discard: true,
        })
      }
    }).pipe(Effect.provide(BunFileSystem.layer)),
  ))
