// Contract: the plugin's skills tell an agent to call tools and fill input
// fields. Every one of them exists on the REAL plugin server: it is started
// from the command in the plugin's own .mcp.json, and tools/list answers.
import { expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from '@modelcontextprotocol/sdk/client/stdio.js'
import { Effect, FileSystem, Schema } from 'effect'
import { schemas } from '../../plugins/webular/src/schemas.ts'
import { ROOT } from '../_support/root.ts'

const PLUGIN = `${ROOT}plugins/webular`
const CLAUDE_ROOT = ['$', '{CLAUDE_PLUGIN_ROOT}'].join('')
const RESEARCH = `${PLUGIN}/skills/webular-research`
// tools.md sections that are not tools of the plugin server. machine.next is
// served by `webular mcp`, the CLI server, not by this plugin.
const NOT_PLUGIN_TOOLS = ['Connect', 'Errors', 'machine.next']
// Live tools the Pick-the-tool table leaves out, each with the reason. A stale entry fails.
const NOT_IN_TABLE: Record<string, string> = {
  jev: 'Left open: the jev tool and its docs are owned by the jev work, not by this contract.',
}
// The paging input every live tool adds on top of its command schema.
const PAGING = 'cursor'

type Live = { name: string; fields: string[]; required: string[] }

const ServerConfig = Schema.fromJsonString(
  Schema.Struct({
    mcpServers: Schema.Struct({
      webular: Schema.Struct({ command: Schema.String, args: Schema.Array(Schema.String) }),
    }),
  }),
)

const run = <A, E>(self: Effect.Effect<A, E, FileSystem.FileSystem>) =>
  Effect.runPromise(self.pipe(Effect.provide(BunServices.layer)))

const read = (path: string) => FileSystem.FileSystem.use((fs) => fs.readFileString(path))

const serverConfig = read(`${PLUGIN}/.mcp.json`).pipe(
  Effect.flatMap(Schema.decodeUnknownEffect(ServerConfig)),
  Effect.map((c) => c.mcpServers.webular),
)

// Starts the plugin server exactly as its .mcp.json says, lists its tools, stops it.
const liveTools = Effect.gen(function* () {
  const { command, args } = yield* serverConfig
  const client = new Client({ name: 'webular-contract', version: '0.0.0' })
  const transport = new StdioClientTransport({
    command,
    args: args.map((a) => a.replace(CLAUDE_ROOT, PLUGIN)),
    cwd: PLUGIN,
    env: getDefaultEnvironment(),
    stderr: 'ignore',
  })
  yield* Effect.acquireRelease(
    Effect.tryPromise(() => client.connect(transport)),
    () => Effect.promise(() => client.close()),
  )
  const { tools } = yield* Effect.tryPromise(() => client.listTools())
  return tools.map(
    (t): Live => ({
      name: t.name,
      fields: Object.keys(t.inputSchema.properties ?? {}).sort(),
      required: [...(t.inputSchema.required ?? [])].sort(),
    }),
  )
}).pipe(Effect.scoped)
// One server start serves every test below.
const live = Effect.runSync(Effect.cached(liveTools))

const spans = (text: string) => [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1] ?? '')
const skillDoc = read(`${RESEARCH}/SKILL.md`)
const toolsDoc = read(`${RESEARCH}/references/tools.md`)

// What schemas.ts says a tool takes, plus the paging field the server adds.
const expected = (name: string) => {
  const shape = schemas[name as keyof typeof schemas].shape as Record<
    string,
    { isOptional(): boolean }
  >
  const own = Object.keys(shape)
  return {
    fields: [...own, PAGING].sort(),
    required: own.filter((k) => !shape[k]?.isOptional()).sort(),
  }
}

const differences = (t: Live) => {
  const want = expected(t.name)
  return (['fields', 'required'] as const)
    .filter((k) => t[k].join() !== want[k].join())
    .map((k) => `${t.name} ${k}: [${t[k]}] vs [${want[k]}]`)
}

// schemas.ts is what the live server must offer: the same tools, the same fields.
test('the live tools/list matches schemas.ts: same tools, input fields, and required fields', () =>
  run(
    Effect.gen(function* () {
      const tools = yield* live
      expect(tools.map((t) => t.name).sort()).toEqual(Object.keys(schemas).sort())
      expect(tools.flatMap(differences)).toEqual([])
    }),
  ))

// Tool names a skill tells the agent to call: the Pick-the-tool table, the
// tool reference sections, and any mcp__webular__<tool> name in a skill file.
const namedTools = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const files = (yield* fs.readDirectory(`${PLUGIN}/skills`, { recursive: true })).filter(
    (p) => p.endsWith('.md') && !p.includes('evals/'),
  )
  const texts = yield* Effect.forEach(files, (p) => read(`${PLUGIN}/skills/${p}`), {
    concurrency: 8,
  })
  const rows = [...(yield* skillDoc).matchAll(/^\| [^|]+ \| `([a-z]+)`( \([^|]*\))? \|$/gm)]
  return {
    table: rows.map((m) => m[1] ?? ''),
    sections: [...(yield* toolsDoc).matchAll(/^## (.+)$/gm)]
      .map((m) => m[1] ?? '')
      .filter((n) => !NOT_PLUGIN_TOOLS.includes(n)),
    prefixed: texts.flatMap((t) =>
      [...t.matchAll(/mcp__webular__([\w.-]+)/g)].map((m) => m[1] ?? ''),
    ),
  }
})

test('every tool a skill tells the agent to call exists on the live server', () =>
  run(
    Effect.gen(function* () {
      const tools = new Set((yield* live).map((t) => t.name))
      const named = yield* namedTools
      expect(named.table.length).toBe(
        Object.keys(schemas).length - Object.keys(NOT_IN_TABLE).length,
      )
      const missing = Object.entries(named).flatMap(([where, names]) =>
        names.filter((n) => !tools.has(n)).map((n) => `${where}: ${n}`),
      )
      expect(missing).toEqual([])
    }),
  ))

test('every live tool is in the Pick-the-tool table, or has a stated reason', () =>
  run(
    Effect.gen(function* () {
      const { table } = yield* namedTools
      const tools = (yield* live).map((t) => t.name)
      const missing = tools.filter((t) => !table.includes(t) && !(t in NOT_IN_TABLE))
      const stale = Object.keys(NOT_IN_TABLE).filter((t) => table.includes(t))
      expect({ missing, stale }).toEqual({ missing: [], stale: [] })
    }),
  ))

// Each field a skill names for a tool is in that tool's live inputSchema: the
// tool reference's Input lines, and the fields in a table row's parentheses.
test('every input field a skill names for a tool is in the live inputSchema', () =>
  run(
    Effect.gen(function* () {
      const tools = new Map((yield* live).map((t) => [t.name, t]))
      const fromReference = (yield* toolsDoc)
        .split(/^## /m)
        .slice(1)
        .flatMap((sec) => {
          const line = /^- Input: (.+)$/m.exec(sec)?.[1] ?? ''
          return spans(line.replace(/\([^)]*\)/g, '')).map((f) => [sec.split('\n')[0] ?? '', f])
        })
      const fromTable = [
        ...(yield* skillDoc).matchAll(/^\| [^|]+ \| `([a-z]+)` \(([^|]*)\) \|$/gm),
      ].flatMap((m) => spans(m[2] ?? '').map((f) => [m[1] ?? '', f]))
      const bad = [...fromReference, ...fromTable]
        .filter(
          ([name, f]) => tools.has(name ?? '') && !tools.get(name ?? '')?.fields.includes(f ?? ''),
        )
        .map(([name, f]) => `${name}: ${f}`)
      expect(fromTable.length).toBeGreaterThan(0)
      expect(bad).toEqual([])
    }),
  ))

// The paging field exists on every live tool, so the research skill must teach it.
test('the research skill documents the paging field every live tool takes', () =>
  run(
    Effect.gen(function* () {
      const tools = yield* live
      expect(tools.filter((t) => !t.fields.includes(PAGING)).map((t) => t.name)).toEqual([])
      expect(spans(yield* skillDoc)).toContain(PAGING)
    }),
  ))
