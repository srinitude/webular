// The e2e coverage map, generated from the code itself: the command table,
// each command's flag specs, the shared flag specs, the MCP tool defs, the
// plugin's tool schemas, and its skill folders. A new command, flag, tool,
// tool input, plugin tool, or skill shows up here with no edit, and the
// parity test fails until an e2e case covers it.
import { Effect, FileSystem } from 'effect'
import { schemas } from '../../plugins/webular/src/schemas.ts'
import { COMMAND_NAMES, type CommandName } from '../../src/cli/commands.ts'
import { webTools } from '../../src/tools/web.ts'
import { ROOT } from '../_support/root.ts'

const SPEC = /'?([a-z][a-z-]*)'?: \{ type: '(?:string|boolean)'/g

const specNames = (text: string): string[] => [...text.matchAll(SPEC)].map((m) => m[1] as string)

export interface Coverage {
  shared: string[]
  flags: Record<CommandName, string[]>
  mcp: Record<string, string[]>
  skills: string[]
}

export const coverage = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const read = (path: string) => fs.readFileString(`${ROOT}${path}`).pipe(Effect.map(specNames))
  const shared = yield* read('src/core/args.ts')
  const perCommand = yield* Effect.forEach(
    COMMAND_NAMES,
    (cmd) => read(`src/commands/${cmd}.ts`).pipe(Effect.map((names) => [cmd, names] as const)),
    { concurrency: 8 },
  )
  const flags = Object.fromEntries(perCommand) as Record<CommandName, string[]>
  const mcp = Object.fromEntries(webTools.map((t) => [t.id, Object.keys(t.schema.shape)]))
  const skills = (yield* fs.readDirectory(`${ROOT}plugins/webular/skills`)).sort()
  return { shared, flags, mcp, skills } satisfies Coverage
})

// One row per surface item.
export const coverageRows = (c: Coverage): [string, string][] => [
  ...COMMAND_NAMES.map((cmd): [string, string] => ['command', cmd]),
  ...COMMAND_NAMES.flatMap((cmd) =>
    c.flags[cmd].map((f): [string, string] => ['flag', `${cmd} --${f}`]),
  ),
  ...c.shared.map((f): [string, string] => ['shared flag', `--${f}`]),
  ...Object.keys(c.mcp).map((id): [string, string] => ['mcp tool', id]),
  ...Object.entries(c.mcp).flatMap(([id, keys]) =>
    keys.map((k): [string, string] => ['mcp input', `${id}.${k}`]),
  ),
  ...Object.keys(schemas).map((id): [string, string] => ['plugin tool', id]),
  ...c.skills.map((s): [string, string] => ['skill', s]),
  ['executable', 'dist/bin/webular'],
]
