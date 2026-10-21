// One tool arm: which tools a run may call, what the prompt hints, and, for a
// peer arm, its MCP server and the keys its child env needs.
import { Effect } from 'effect'
import { readKey } from '../../../scripts/bench/peers/keys.ts'
import type { Provider, Surface } from '../scenarios.ts'

export const WEBULAR = 'webular'

type Own = Exclude<Surface, 'peer'>

const ALLOWED: Record<Own, string[]> = {
  cli: ['Bash(webular:*)', 'Bash(webular *)'],
  mcp: ['mcp__webular'],
  plugin: ['mcp__plugin_webular_webular', 'Skill', 'ReadMcpResourceTool', 'ListMcpResourcesTool'],
}

// Built-in tools the run can see at all; MCP tools come from the config or plugin.
const BUILTIN: Record<Surface, string> = {
  cli: 'Bash',
  mcp: 'ReadMcpResourceTool,ListMcpResourcesTool',
  plugin: 'Skill,ReadMcpResourceTool,ListMcpResourcesTool',
  peer: '',
}

const HINT: Record<Own, string> = {
  cli: 'Use the `webular` command line tool (it is on PATH; `webular --help` lists its commands; add --json for JSON output).',
  mcp: 'Use the webular MCP server tools.',
  plugin: 'Use the webular plugin: its MCP tools and skills.',
}

// A peer arm allows only its own MCP server.
export const allowedTools = (surface: Surface, provider = WEBULAR) =>
  surface === 'peer' ? [`mcp__${provider}`] : ALLOWED[surface]

export const builtinTools = (surface: Surface) => BUILTIN[surface]

export const hint = (surface: Surface, provider = WEBULAR) =>
  surface === 'peer' ? `Use the ${provider} MCP server tools.` : HINT[surface]

// The config names each key as ${ENV}; Claude Code fills it from the child
// env, so no key value is ever written to the config file.
export const peerServer = (p: Provider) => ({
  [p.id]: {
    command: p.command,
    args: [...p.args],
    env: Object.fromEntries(p.keys.map((k) => [k.env, `\${${k.env}}`])),
  },
})

// Every key the provider needs, or the names of the ones that are missing.
export const peerKeys = (p: Provider) =>
  Effect.gen(function* () {
    const found = yield* Effect.forEach(
      p.keys,
      (k) => Effect.map(readKey(k.env, k.item), (v) => ({ k, v })),
      { concurrency: 1 },
    )
    const missing = found.filter((f) => !f.v).map((f) => `${f.k.env} or Keychain ${f.k.item}`)
    const env = Object.fromEntries(found.map((f) => [f.k.env, f.v ?? '']))
    return { env, missing }
  })
