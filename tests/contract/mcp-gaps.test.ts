// Agent contract gaps for `webular mcp` over stdio, against the real server:
// every command tool's structuredContent matches its declared output schema
// and its workflow's output schema (clause 2), a bad input's isError text is
// the CLI's own usage error for the same command (clauses 3 and 7), and
// tools/list names every CLI command except the recorded NOT_ON_MCP ones (clause 7).
import { describe, expect, test } from 'bun:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { Effect } from 'effect'
import type { z } from 'zod'
import { commandTools } from '../../plugins/webular/src/commands.ts'
import { COMMAND_NAMES } from '../../src/cli/commands.ts'
import { NOT_ON_MCP, webTools } from '../../src/tools/web.ts'
import { runCli } from '../_support/cli.ts'
import { useFixture } from '../_support/fixture.ts'
import { mcpHostEnv } from '../_support/mcp-env.ts'
import { ROOT } from '../_support/root.ts'
import { defaultRoutes } from '../_support/routes.ts'
import { eff, io } from '../_support/run.ts'

const RSS =
  '<rss version="2.0"><channel><title>F</title><item><title>One</title></item></channel></rss>'
const fx = useFixture((o) => ({
  ...defaultRoutes(o),
  '/feed.xml': () => new Response(RSS, { headers: { 'content-type': 'application/rss+xml' } }),
}))

// Command tools with a fixture call; the rest need the web, a browser, or a host database.
const CALLS: Record<string, (o: string) => Record<string, unknown>> = {
  scrape: (o) => ({ url: `${o}/a` }),
  map: (o) => ({ url: `${o}/`, limit: 5 }),
  crawl: (o) => ({ url: `${o}/`, limit: 2, depth: 1 }),
  extract: (o) => ({ url: `${o}/a`, selector: 'title' }),
  feed: (o) => ({ url: `${o}/feed.xml` }),
  summarize: () => ({ text: 'One fact. Two facts. Three facts. Four facts.' }),
  batch: (o) => ({ urls: [`${o}/a`, `${o}/b`] }),
  parse: () => ({ file: `${ROOT}package.json` }),
  diagram: () => ({}),
  tasks: () => ({}),
}

// Inputs the CLI rejects as wrong usage (exit 2). The MCP input schema lets each
// bad value through, so the agent sees the CLI's own usage error.
const BAD: Record<string, Record<string, unknown>> = {
  map: { url: 'http://127.0.0.1:9/', limit: 0 },
  crawl: { url: 'http://127.0.0.1:9/', depth: -1 },
}

const connected = Effect.acquireRelease(
  Effect.gen(function* () {
    const host = yield* mcpHostEnv
    const client = new Client({ name: 'webular-contract-gaps', version: '0.0.0' })
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [`${ROOT}src/commands/mcp.ts`],
      cwd: ROOT,
      env: { ...host, WEBULAR_NO_CACHE: '1', WEBULAR_JEV: 'off', WEBULAR_ALLOW_PRIVATE: '1' },
      stderr: 'ignore',
    })
    return yield* io(() => client.connect(transport)).pipe(Effect.as(client))
  }),
  (client) => Effect.promise(() => client.close()),
)

const textOf = (r: Record<string, unknown>) =>
  ((r['content'] ?? []) as { text?: string }[]).map((c) => c.text ?? '').join('\n')

const issues = (schema: z.ZodType, value: unknown) =>
  schema.safeParse(value).error?.issues.map((i) => `${i.path.join('.')}: ${i.message}`) ?? []

const workflowSchema = (name: string) =>
  io(() => import(`../../src/workflows/${name}.ts`)).pipe(
    Effect.map((m) => (m[`${name}Workflow`] as { outputSchema: z.ZodType }).outputSchema),
  )

const toolSchema = (name: string) =>
  commandTools.find((t) => t.id === name)?.outputSchema as z.ZodType

const call = (client: Client, name: string, args: Record<string, unknown>) =>
  io(() => client.callTool({ name, arguments: args }))

const checkOutput = (client: Client, name: string) =>
  Effect.gen(function* () {
    const r = yield* call(client, name, CALLS[name]?.(fx.origin) ?? {})
    const wf = yield* workflowSchema(name)
    const value = r.structuredContent
    return {
      name,
      error: r.isError ? textOf(r) : '',
      tool: issues(toolSchema(name), value),
      workflow: issues(wf, value),
    }
  })

const checkError = (client: Client, name: string) =>
  Effect.gen(function* () {
    const args = BAD[name] ?? {}
    const r = yield* call(client, name, args)
    const flags = Object.entries(args).map(([k, v]) => `--${k}=${String(v)}`)
    const cli = yield* runCli(`src/commands/${name}.ts`, [...flags, '--json'])
    const want = `webular ${name} failed: ${cli.err.trim()}. Fix the input and call it again.`
    return { name, code: cli.code, isError: r.isError ?? false, text: textOf(r), want }
  })

const outputsMatch = Effect.gen(function* () {
  const client = yield* connected
  const results = yield* Effect.forEach(Object.keys(CALLS), (n) => checkOutput(client, n), {
    concurrency: 4,
  })
  for (const r of results) expect(r).toEqual({ name: r.name, error: '', tool: [], workflow: [] })
})

const errorsMatch = Effect.gen(function* () {
  const client = yield* connected
  const results = yield* Effect.forEach(Object.keys(BAD), (n) => checkError(client, n), {
    concurrency: 2,
  })
  for (const r of results)
    expect({ name: r.name, code: r.code, isError: r.isError, text: r.text }).toEqual({
      name: r.name,
      code: 2,
      isError: true,
      text: r.want,
    })
})

const namesMatch = Effect.gen(function* () {
  const client = yield* connected
  const { tools } = yield* io(() => client.listTools())
  const commands = tools.map((t) => t.name).filter((n) => !webTools.some((w) => w.id === n))
  const want = COMMAND_NAMES.filter((n) => !(n in NOT_ON_MCP))
  expect([...commands].sort()).toEqual([...want].sort())
})

describe('webular mcp — agent contract gaps over stdio', () => {
  test(
    "each command tool's structuredContent matches its tool and workflow output schemas",
    eff(outputsMatch),
    90_000,
  )
  test("a bad input's isError text is the CLI's usage error", eff(errorsMatch), 30_000)
  test('tools/list names every CLI command except NOT_ON_MCP', eff(namesMatch), 20_000)
})
