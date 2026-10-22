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
import { type Duration, Effect } from 'effect'
import type { ChildProcessSpawner } from 'effect/process'
import type { z } from 'zod'
import { commandTools, type EntryOf } from '../../plugins/webular/src/commands.ts'
import { fetchText } from '../core/http.ts'
import { errMsg, pageText, selectFields, shortError, stableJson } from '../core/output.ts'
import { extractLinks, htmlToArticle, htmlToMarkdown } from '../lib/html.ts'
import { type CallExtra, failure, type McpText, runTool, withProgress } from './web-call.ts'
import { machineSchema, machineState, ToolArgsError } from './web-machine.ts'
import { hintsOnly, lenient, webMeta } from './web-register.ts'
import {
  fetchSchema,
  linksSchema,
  markdownSchema,
  pagingSchema,
  readabilitySchema,
} from './web-schemas.ts'

interface McpToolDef {
  id: string
  description: string
  schema: z.ZodObject<z.ZodRawShape>
  run(args: Record<string, unknown>): Effect.Effect<unknown, unknown>
}

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
    description:
      'Low-level: fetch a URL and return its raw HTML, not Markdown. To read a page, use scrape; use this only to feed web_links, web_markdown, or web_readability.',
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

// Registering mutates the server, so it is an Effect: it captures the caller's
// context once, and each MCP Promise handler runs its tool Effect with it.
// Command tools register on both servers alike; extra.signal cancels a call.
type RunWith = <A, E>(
  effect: Effect.Effect<A, E, ChildProcessSpawner.ChildProcessSpawner>,
  options: { signal: AbortSignal },
) => Promise<A>

// Registration order is tools/list order, so register every tool sorted by id.
const commandRegistration =
  (server: McpServer, runWith: RunWith, limit: Duration.Input, entryOf?: EntryOf) =>
  ({ id, outputSchema: _, inputSchema, ...config }: (typeof commandTools)[number]) =>
    [
      id,
      () =>
        server.registerTool(
          id,
          { ...hintsOnly(config), inputSchema: lenient(inputSchema) },
          (args: Record<string, unknown>, extra: CallExtra) =>
            runWith(withProgress(id, extra, runTool(id, args, limit, entryOf)), {
              signal: extra.signal,
            }),
        ),
    ] as const

const webRegistration =
  (server: McpServer, runWith: RunWith) => (tool: (typeof webTools)[number]) =>
    [
      tool.id,
      () =>
        server.registerTool(
          tool.id,
          { ...webMeta(tool), inputSchema: tool.schema },
          (args: Record<string, unknown>, { signal }) => runWith(execute(tool, args), { signal }),
        ),
    ] as const

const toolRegistrations = (
  server: McpServer,
  runWith: RunWith,
  limit: Duration.Input,
  entryOf?: EntryOf,
) =>
  [
    ...commandTools.map(commandRegistration(server, runWith, limit, entryOf)),
    ...webTools.map(webRegistration(server, runWith)),
  ].sort(([x], [y]) => (x < y ? -1 : 1))

export const registerAll = Effect.fn('registerAll')(function* (
  server: McpServer,
  entryOf?: EntryOf,
  limit: Duration.Input = '10 minutes',
) {
  const runWith = Effect.runPromiseWith(
    yield* Effect.context<ChildProcessSpawner.ChildProcessSpawner>(),
  )
  for (const [, register] of toolRegistrations(server, runWith, limit, entryOf)) register()
})
