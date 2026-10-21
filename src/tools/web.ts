// MCP tool definitions wrapping the FOSS HTML/fetch primitives — the single
// source for `webular mcp` (--list and serve register the same defs, so the
// two surfaces cannot drift). run() re-parses with the same zod schema for
// defense in depth; a failing tool becomes isError content, never a protocol
// failure.
//
// Token rules: tools sorted by id with static descriptions (a byte-stable
// tools/list keeps client prompt caches warm); results are sorted-key compact
// JSON, narrowed by `select`, paged under PAGE_MAX_CHARS with an opaque
// `cursor`; errors are one short line.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Effect } from 'effect'
import type { ChildProcessSpawner } from 'effect/process'
import { z } from 'zod'
import {
  CommandFailed,
  commandTools,
  type EntryOf,
  runCommand,
} from '../../plugins/webular/src/commands.ts'
import { fetchText } from '../core/http.ts'
import { errMsg, pageText, selectFields, shortError, stableJson } from '../core/output.ts'
import { extractLinks, htmlToArticle, htmlToMarkdown } from '../lib/html.ts'
import { machineSchema, machineState, paging, ToolArgsError } from './web-machine.ts'
import { lenient } from './web-register.ts'

interface McpToolDef {
  id: string
  description: string
  schema: z.ZodObject<z.ZodRawShape>
  run(args: Record<string, unknown>): Effect.Effect<unknown, unknown>
}

const pagingSchema = z.object(paging)
const fetchSchema = z.object({
  url: z.url(),
  timeoutMs: z.number().int().positive().optional(),
  ...paging,
})
const readabilitySchema = z.object({ html: z.string(), ...paging })
const markdownSchema = z.object({ html: z.string(), ...paging })
const linksSchema = z.object({
  html: z.string(),
  base: z.url(),
  limit: z.number().int().min(1).max(1000).optional(),
  ...paging,
})
const parseArgs = <T>(schema: z.ZodType<T>, args: Record<string, unknown>) =>
  Effect.try({
    try: () => schema.parse(args),
    catch: (e) => new ToolArgsError({ message: errMsg(e) }),
  })

// Sorted by id: registration order is tools/list order.
export const webTools: McpToolDef[] = [
  {
    id: 'machine.next',
    description: 'Replay events on a machine; return its state and allowed next events.',
    schema: machineSchema,
    run: (args) =>
      Effect.gen(function* () {
        const { machine, events } = yield* parseArgs(machineSchema, args)
        return yield* machineState(machine, events)
      }),
  },
  {
    id: 'web.fetch',
    description: 'Fetch a URL and return its raw HTML (Bun.fetch).',
    schema: fetchSchema,
    run: (args) =>
      Effect.gen(function* () {
        const { url, timeoutMs } = yield* parseArgs(fetchSchema, args)
        return { url, html: yield* fetchText(url, { timeoutMs }) }
      }),
  },
  {
    id: 'web.links',
    description: 'Extract absolute links from HTML (linkedom).',
    schema: linksSchema,
    run: (args) =>
      parseArgs(linksSchema, args).pipe(
        Effect.map((a) => ({ links: extractLinks(a.html, a.base).slice(0, a.limit) })),
      ),
  },
  {
    id: 'web.markdown',
    description: 'Convert HTML to Markdown (Turndown).',
    schema: markdownSchema,
    run: (args) =>
      parseArgs(markdownSchema, args).pipe(
        Effect.map((a) => ({ markdown: htmlToMarkdown(a.html) })),
      ),
  },
  {
    id: 'web.readability',
    description: 'Extract main article content (Mozilla Readability + linkedom).',
    schema: readabilitySchema,
    run: (args) =>
      parseArgs(readabilitySchema, args).pipe(Effect.map((a) => htmlToArticle(a.html))),
  },
]

interface McpText {
  [key: string]: unknown
  content: { type: 'text'; text: string }[]
  isError?: boolean
}

const failure = (text: string): McpText => ({ content: [{ type: 'text', text }], isError: true })

// ponytail: each page re-runs the tool; web.fetch pages lean on the HTTP cache.
function execute(tool: McpToolDef, args: Record<string, unknown>): Effect.Effect<McpText> {
  return Effect.gen(function* () {
    const { cursor, select } = yield* parseArgs(pagingSchema, args)
    const value = yield* tool.run(args)
    const page = yield* Effect.try(() => pageText(stableJson(selectFields(value, select)), cursor))
    if (!page.ok) return failure(page.error)
    const content: McpText['content'] = [{ type: 'text', text: page.text }]
    if (page.nextCursor) {
      const more = { nextCursor: page.nextCursor, totalChars: page.totalChars }
      content.push({ type: 'text', text: stableJson(more) })
    }
    return { content }
  }).pipe(Effect.catch((err) => Effect.succeed(failure(shortError(err)))))
}

// Commands with no MCP tool, each with the reason. Every other command in
// src/cli/commands.ts is a tool on both MCP servers.
export const NOT_ON_MCP = {
  mcp: 'It starts the MCP server itself, so it cannot be a tool on that server.',
} as const

// Every tool `webular mcp` lists, in tools/list order.
export const mcpToolIds = [...webTools.map((t) => t.id), ...commandTools.map((t) => t.id)].sort()

// A command tool: the plugin's runCommand, with the result as compact JSON text.
// The plugin's own numeric cursor pages a long result.
const runTool = (id: string, args: Record<string, unknown>, entryOf?: EntryOf) => {
  const { cursor, ...input } = args
  return runCommand(id, input, typeof cursor === 'number' ? cursor : 0, entryOf).pipe(
    Effect.map(
      (result): McpText => ({
        content: [{ type: 'text', text: stableJson(result) }],
        structuredContent: result,
      }),
    ),
    Effect.catch((e) =>
      Effect.succeed(failure(e instanceof CommandFailed ? e.message : shortError(e))),
    ),
  )
}

// Registering mutates the server, so it is an Effect: it captures the caller's
// context once, and each MCP Promise handler runs its tool Effect with it.
// Command tools register on both servers alike.
type RunWith = <A, E>(
  effect: Effect.Effect<A, E, ChildProcessSpawner.ChildProcessSpawner>,
) => Promise<A>

// Registration order is tools/list order, so register every tool sorted by id.
const toolRegistrations = (server: McpServer, runWith: RunWith, entryOf?: EntryOf) =>
  [
    ...commandTools.map(
      ({ id, outputSchema: _, inputSchema, ...config }) =>
        [
          id,
          () =>
            server.registerTool(
              id,
              { ...config, inputSchema: lenient(inputSchema) },
              (args: Record<string, unknown>) => runWith(runTool(id, args, entryOf)),
            ),
        ] as const,
    ),
    ...webTools.map(
      (tool) =>
        [
          tool.id,
          () =>
            server.registerTool(
              tool.id,
              { description: tool.description, inputSchema: tool.schema.shape },
              (args: Record<string, unknown>) => runWith(execute(tool, args)),
            ),
        ] as const,
    ),
  ].sort(([x], [y]) => (x < y ? -1 : 1))

export const registerAll = Effect.fn('registerAll')(function* (
  server: McpServer,
  entryOf?: EntryOf,
) {
  const runWith = Effect.runPromiseWith(
    yield* Effect.context<ChildProcessSpawner.ChildProcessSpawner>(),
  )
  for (const [, register] of toolRegistrations(server, runWith, entryOf)) register()
})
