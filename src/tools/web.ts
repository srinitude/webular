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
import { Data, Effect } from 'effect'
import { z } from 'zod'
import { appResources } from '../../plugins/webular/src/apps.ts'
import { fetchText } from '../core/http.ts'
import { errMsg, pageText, selectFields, shortError, stableJson } from '../core/output.ts'
import { extractLinks, htmlToArticle, htmlToMarkdown } from '../lib/html.ts'

class ToolArgsError extends Data.TaggedError('ToolArgsError')<{ readonly message: string }> {}

interface McpToolDef {
  id: string
  description: string
  schema: z.ZodObject<z.ZodRawShape>
  run(args: Record<string, unknown>): Effect.Effect<unknown, unknown>
}

const paging = {
  cursor: z.string().optional().describe('nextCursor from the previous page'),
  select: z.array(z.string()).optional().describe('Top-level result select to keep'),
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
    description: 'Extract absolute links from HTML (linkedom document parse).',
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

class AppNotBuilt extends Data.TaggedError('AppNotBuilt')<{ readonly message: string }> {}

// The MCP Apps media type, as the plugin's Mastra server lists it.
const APP_MIME = 'text/html;profile=mcp-app'

// Each view reads its built page on demand, from the plugin's own resource list.
// ponytail: htmlPath is a checkout path; embed the pages when the compiled
// executable needs to serve views.
const readApp = (uri: string, htmlPath: string) =>
  Effect.tryPromise({
    try: () => Bun.file(htmlPath).text(),
    catch: () => new AppNotBuilt({ message: `${uri} is not built. Run \`mise run plugin:ui\`.` }),
  }).pipe(Effect.map((text) => ({ contents: [{ uri, mimeType: APP_MIME, text }] })))

// Registering mutates the server, so it is an Effect: it captures the caller's
// context once, and each MCP Promise handler runs its tool Effect with it.
// The plugin's MCP App views register too, so both servers list the same apps.
export const registerAll = Effect.fn('registerAll')(function* (server: McpServer) {
  const runWith = Effect.runPromiseWith(yield* Effect.context<never>())
  for (const tool of webTools) {
    server.registerTool(
      tool.id,
      { description: tool.description, inputSchema: tool.schema.shape },
      (args: Record<string, unknown>) => runWith(execute(tool, args)),
    )
  }
  for (const [uri, app] of Object.entries(appResources)) {
    server.registerResource(
      app.name,
      uri,
      { description: app.description, mimeType: APP_MIME },
      () => runWith(readApp(uri, app.htmlPath)),
    )
  }
})
