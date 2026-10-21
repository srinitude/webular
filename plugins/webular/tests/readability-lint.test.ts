// Readability lint: every agent- and user-facing string follows the built-in
// human-language skill's rules (no filler, no cut words, short sentences, and
// the exact names a Jev question must carry). Strings that another test pins
// word for word are listed in readability-lint-exempt.json with that test.
import { expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem } from 'effect'
import { z } from 'zod'
import { COMMANDS } from '../../../src/cli/commands.ts'
import { GLOBAL_OPTIONS } from '../../../src/cli/help.ts'
import decisionsFile from '../evals/decisions.json' with { type: 'json' }
import { proseIssues } from '../skills/human-language/scripts/plain.ts'
import descriptions from '../src/descriptions.json' with { type: 'json' }
import { schemas } from '../src/schemas.ts'
import exemptFile from './readability-lint-exempt.json' with { type: 'json' }

type Item = { where: string; text: string; names?: ReadonlyArray<string> }
// An empty exempt list infers as never[]; the entry type keeps both tests typed.
const exempt: ReadonlyArray<{ text: string; checkedBy: string }> = exemptFile

// Every `description` value in a JSON Schema tree.
const schemaTexts = (node: unknown, where: string): Array<Item> =>
  node && typeof node === 'object'
    ? Object.entries(node).flatMap(([key, value]) =>
        key === 'description' && typeof value === 'string'
          ? [{ where, text: value }]
          : schemaTexts(value, `${where}.${key}`),
      )
    : []

const matches = (source: string, pattern: RegExp, where: string): Array<Item> =>
  [...source.matchAll(pattern)].map((m): Item => ({ where, text: m[1] ?? '' }))

// Usage errors: every quoted `message` in a command file.
const commandsDir = fileURLToPath(new URL('../../../src/commands/', import.meta.url))
// MCP command tools: the failure messages and `.describe` texts in commands.ts.
// A `${...}` slot reads as one word.
const pluginCommands = fileURLToPath(new URL('../src/commands.ts', import.meta.url))
const pluginTexts = (source: string): Array<Item> => [
  ...matches(source, /\.describe\('((?:[^'\\]|\\.)*)'\)/g, 'mcp commands.ts describe'),
  ...matches(
    source.replace(/\$\{[^}]*\}/g, 'X'),
    /`(webular X [^`]*)`/g,
    'mcp commands.ts message',
  ),
]

const fileItems = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const files = (yield* fs.readDirectory(commandsDir)).filter((f) => f.endsWith('.ts'))
  const usage = yield* Effect.forEach(
    files,
    (file) =>
      fs
        .readFileString(`${commandsDir}${file}`)
        .pipe(
          Effect.map((source) =>
            matches(source, /(?:message: *|const message = )'((?:[^'\\]|\\.)*)'/g, `usage ${file}`),
          ),
        ),
    { concurrency: 8 },
  )
  const plugin = pluginTexts(yield* fs.readFileString(pluginCommands))
  return [...usage.flat(), ...plugin]
}).pipe(Effect.provide(BunServices.layer))

const staticItems: Array<Item> = [
  ...Object.entries(COMMANDS).map(([name, text]) => ({ where: `help ${name}`, text })),
  ...GLOBAL_OPTIONS.map((line) => ({ where: 'help global option', text: line.slice(20) })),
  { where: 'mcp server', text: descriptions.server },
  ...Object.entries(descriptions.tools).map(([name, text]) => ({ where: `mcp ${name}`, text })),
  ...Object.entries(descriptions.titles).map(([name, text]) => ({ where: `title ${name}`, text })),
  ...Object.entries(schemas).flatMap(([name, schema]) =>
    schemaTexts(z.toJSONSchema(schema), `schema ${name}`),
  ),
  ...decisionsFile.decisions.flatMap((d) => [
    { where: `jev ${d.id} question`, text: d.question, names: ['`input'] },
    ...d.labels.map((label) => ({ where: `jev ${d.id} label`, text: label })),
  ]),
]

const allItems = Effect.map(fileItems, (found) => [...staticItems, ...found])

const exemptTexts = new Set(exempt.map((entry) => entry.text))

// Each check runs over every collected string.
const withItems = (check: (items: Array<Item>) => void) =>
  Effect.runPromise(Effect.map(allItems, check))

test('every help, usage, MCP, schema, and Jev string follows the human-language rules', () =>
  withItems((items) => {
    const broken = items
      .filter((item) => !exemptTexts.has(item.text))
      .flatMap((item) =>
        proseIssues(item.text, item.names).map((issue) => `${item.where}: ${issue}`),
      )
    expect(broken).toEqual([])
  }))

test('the lint reads the MCP command tool messages and descriptions', () =>
  withItems((items) => {
    const plugin = items.filter((item) => item.where.startsWith('mcp commands.ts'))
    expect(plugin.some((item) => item.text.includes('could not start'))).toBe(true)
    expect(plugin.some((item) => item.text.startsWith('Where to pick up'))).toBe(true)
  }))

test('every exempt string is still in use and names the test that pins it', () =>
  withItems((items) => {
    const texts = new Set(items.map((item) => item.text))
    for (const entry of exempt) {
      expect(`${entry.text}: ${texts.has(entry.text)}`).toBe(`${entry.text}: true`)
      expect(entry.checkedBy).toMatch(/^tests\/.+\.test\.ts$/)
    }
  }))

test('the checker catches filler, cut words, long sentences, and missing names', () => {
  expect(proseIssues('Utilize it in order to read.')).toEqual([
    'filler: Utilize',
    'filler: in order to',
  ])
  expect(proseIssues('A seamless page.')).toEqual(['cut: seamless'])
  expect(proseIssues(`${'word '.repeat(40)}.`)).toEqual(['long sentence: 41 words'])
  expect(proseIssues('Does it answer?', ['`input'])).toEqual(['missing name: `input'])
  expect(proseIssues('Use `in order to` as a key.')).toEqual([])
})
