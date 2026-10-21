// agentskills.io spec checks for the two readability skills the plugin ships: the SKILL.md
// frontmatter rules of the specification page, the body-size advice, and the eval case shape
// of the evaluating-skills page (prompt, expected_output, assertions, optional files).
import { expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, Schema } from 'effect'

const root = fileURLToPath(new URL('../skills', import.meta.url))
const skills = ['human-language', 'rich-and-native-markdown']
const specKeys = ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools']

const EvalCase = Schema.Struct({
  id: Schema.String,
  prompt: Schema.NonEmptyString,
  expected_output: Schema.NonEmptyString,
  assertions: Schema.NonEmptyArray(Schema.NonEmptyString),
  files: Schema.optional(Schema.Array(Schema.String)),
})
const EvalFile = Schema.Struct({ skill_name: Schema.String, evals: Schema.Array(EvalCase) })

const FrontMatter = Schema.Struct({
  name: Schema.String.check(Schema.isMaxLength(64), Schema.isPattern(/^[a-z0-9]+(-[a-z0-9]+)*$/)),
  description: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(1024)),
  license: Schema.optional(Schema.String),
  compatibility: Schema.optional(
    Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(500)),
  ),
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  'allowed-tools': Schema.optional(Schema.String),
})

const readSkill = (skill: string, path: string) =>
  Effect.gen(function* () {
    return yield* (yield* FileSystem.FileSystem).readFileString(`${root}/${skill}/${path}`)
  })

const checkFrontmatter = (skill: string) =>
  Effect.gen(function* () {
    const text = yield* readSkill(skill, 'SKILL.md')
    const block = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? ''
    const front = yield* Effect.try(() => Bun.YAML.parse(block) as Record<string, unknown>)
    expect(Object.keys(front).filter((k) => !specKeys.includes(k))).toEqual([])
    const decoded = yield* Schema.decodeUnknownEffect(FrontMatter)(front)
    expect(decoded.name).toBe(skill)
    expect(text.split('\n').length).toBeLessThan(500)
  })

const checkEvalShape = (skill: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const file = yield* readSkill(skill, 'evals/evals.json').pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(EvalFile))),
    )
    expect(file.skill_name).toBe(skill)
    expect(new Set(file.evals.map((c) => c.id)).size).toBe(file.evals.length)
    const missing = yield* Effect.forEach(
      file.evals.flatMap((c) => c.files ?? []),
      (path) => Effect.map(fs.exists(`${root}/${skill}/${path}`), (ok) => (ok ? '' : path)),
      { concurrency: 4 },
    )
    expect(missing.filter(Boolean)).toEqual([])
  })

const each = (check: (skill: string) => Effect.Effect<void, unknown, FileSystem.FileSystem>) =>
  Effect.runPromise(
    Effect.forEach(skills, check, { concurrency: 2 }).pipe(Effect.provide(BunServices.layer)),
  )

test('SKILL.md frontmatter follows the agentskills.io specification', () => each(checkFrontmatter))

test('eval cases follow the agentskills.io case shape', () => each(checkEvalShape))
