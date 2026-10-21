// Parity evals for tool text. src/descriptions.json is the one source for
// agent-facing tool names, titles, and descriptions; server.ts reads it, and
// every other place that names a tool is checked against it here.
import { expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem } from 'effect'
import descriptions from '../src/descriptions.json' with { type: 'json' }
import { schemas } from '../src/schemas.ts'

const repo = fileURLToPath(new URL('../../../', import.meta.url))
const tools = Object.keys(descriptions.tools).sort()

const read = (path: string) =>
  FileSystem.FileSystem.pipe(
    Effect.flatMap((fs) => fs.readFileString(`${repo}${path}`)),
    Effect.provide(BunServices.layer),
  )

const checkNames = (mise: string, commands: string) => {
  for (const tool of tools) {
    expect(mise).toContain(`[tasks."run:${tool}"]`)
    expect(commands).toMatch(new RegExp(`^ {2}${tool}: '`, 'm'))
  }
}

test('every described tool has a title and an input schema, and nothing else does', () => {
  expect(Object.keys(descriptions.titles).sort()).toEqual(tools)
  expect(Object.keys(schemas).sort()).toEqual(tools)
})

test('every described tool is a CLI command with a mise run task', () =>
  Effect.runPromise(
    Effect.all([read('mise.toml'), read('src/cli/commands.ts')], { concurrency: 2 }).pipe(
      Effect.flatMap(([mise, commands]) => Effect.sync(() => checkNames(mise, commands))),
    ),
  ))
