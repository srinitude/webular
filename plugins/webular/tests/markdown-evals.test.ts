// Skill evals for rich-and-native-markdown: check.ts finds nothing in each case's stored
// good text and finds the case's named finding in its bad text.
import { expect, test } from 'bun:test'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, Schema } from 'effect'
import { checkMarkdown } from '../skills/rich-and-native-markdown/scripts/check.ts'

const evalsPath = fileURLToPath(
  new URL('../skills/rich-and-native-markdown/evals/evals.json', import.meta.url),
)
const Case = Schema.Struct({
  id: Schema.String,
  finding: Schema.String,
  good: Schema.String,
  bad: Schema.String,
})
const decodeEvals = Schema.decodeUnknownEffect(
  Schema.fromJsonString(Schema.Struct({ evals: Schema.Array(Case) })),
)

// Writes one Markdown text into a scoped TMPDIR folder (removed on exit) and checks it.
const findingsOf = (fs: FileSystem.FileSystem, text: string) =>
  Effect.scoped(
    Effect.gen(function* () {
      const dir = yield* fs.makeTempDirectoryScoped({ directory: tmpdir(), prefix: 'md-eval-' })
      yield* fs.writeFileString(`${dir}/case.md`, text)
      const r = yield* checkMarkdown([`${dir}/case.md`])
      return [...r.errors, ...r.needs_review]
    }),
  )

const proves = (id: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const { evals } = yield* decodeEvals(yield* fs.readFileString(evalsPath))
    const c = evals.find((e) => e.id === id)
    expect(c?.id).toBe(id)
    if (!c) return
    expect(yield* findingsOf(fs, c.good)).toEqual([])
    const bad = yield* findingsOf(fs, c.bad)
    expect(bad.some((e) => e.includes(c.finding))).toBe(true)
  }).pipe(Effect.provide(BunServices.layer), Effect.runPromise)

test('scrape-output-keeps-quote-and-source-url: check.ts passes good and flags bad', () =>
  proves('scrape-output-keeps-quote-and-source-url'))

test('research-report-marks-unsourced-claims: check.ts passes good and flags bad', () =>
  proves('research-report-marks-unsourced-claims'))

test('readme-over-limit-splits-into-linked-files: check.ts passes good and flags bad', () =>
  proves('readme-over-limit-splits-into-linked-files'))

test('prompt-text-stays-data-not-orders: check.ts passes good and flags bad', () =>
  proves('prompt-text-stays-data-not-orders'))

test('skill-file-needs-linked-references: check.ts passes good and flags bad', () =>
  proves('skill-file-needs-linked-references'))
