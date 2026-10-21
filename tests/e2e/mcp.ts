// The MCP surface from the user's side: one real stdio client talks to
// `bun dist/commands/mcp.js`, checks that tools/list names every web tool and
// every CLI command (src/cli/commands.ts) except the recorded NOT_ON_MCP ones,
// then calls each MCP case and checks isError, output size, and latency.
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from '@modelcontextprotocol/sdk/client/stdio.js'
import { Duration, Effect } from 'effect'
import { COMMAND_NAMES } from '../../src/cli/commands.ts'
import { NOT_ON_MCP, webTools } from '../../src/tools/web.ts'
import { ROOT } from '../_support/root.ts'
import { MCP_CASES, type McpCase } from './cases.ts'

const MAX_CHARS = 6000
const MAX_MS = 3000

const connect = (env: Record<string, string>) => {
  const client = new Client({ name: 'webular-e2e', version: '0.0.0' })
  const transport = new StdioClientTransport({
    command: 'bun',
    args: [`${ROOT}dist/commands/mcp.js`],
    cwd: ROOT,
    env: { ...getDefaultEnvironment(), ...env },
    stderr: 'ignore',
  })
  return Effect.acquireRelease(
    Effect.tryPromise(() => client.connect(transport)).pipe(Effect.as(client)),
    () => Effect.promise(() => client.close()),
  )
}

const fillArgs = (args: Record<string, unknown>, fill: (s: string) => string) =>
  Object.fromEntries(Object.entries(args).map(([k, v]) => [k, typeof v === 'string' ? fill(v) : v]))

const verdict = (c: McpCase, isError: boolean, size: number, ms: number) => {
  const bad = [
    ...(isError !== Boolean(c.error) ? [`isError=${isError}`] : []),
    ...(size > MAX_CHARS ? [`${size} chars > ${MAX_CHARS}`] : []),
    ...(ms > MAX_MS ? [`${Math.round(ms)}ms > ${MAX_MS}ms`] : []),
  ]
  const label = `mcp ${c.tool} ${Object.keys(c.args).join(',')}${c.error ? ' (error path)' : ''}`
  return bad.length ? `FAIL ${label}: ${bad.join('; ')}` : `pass ${label} (${Math.round(ms)}ms)`
}

const callCase = (client: Client, c: McpCase, fill: (s: string) => string) =>
  Effect.tryPromise(() =>
    client.callTool({ name: c.tool, arguments: fillArgs(c.args, fill) }),
  ).pipe(
    Effect.timed,
    Effect.map(([took, r]) =>
      verdict(c, Boolean(r.isError), JSON.stringify(r.content).length, Duration.toMillis(took)),
    ),
    Effect.catch((e) => Effect.succeed(`FAIL mcp ${c.tool}: ${String(e)}`)),
  )

export const runMcp = (fill: (s: string) => string, env: Record<string, string>) =>
  Effect.gen(function* () {
    const client = yield* connect(env)
    const listed = yield* Effect.tryPromise(() => client.listTools())
    const got = listed.tools.map((t) => t.name).sort()
    const commands = COMMAND_NAMES.filter((name) => !(name in NOT_ON_MCP))
    const want = [...webTools.map((t) => t.id), ...commands].sort()
    const list =
      got.join() === want.join()
        ? `pass mcp tools/list (${got.length} tools)`
        : `FAIL mcp tools/list: got ${got.join()} want ${want.join()}`
    const calls = yield* Effect.forEach(MCP_CASES, (c) => callCase(client, c, fill), {
      concurrency: 4,
    })
    return [list, ...calls]
  }).pipe(Effect.scoped)
