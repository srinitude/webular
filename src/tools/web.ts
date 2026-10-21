// MCP tool definitions wrapping the FOSS HTML/fetch primitives — the single
// source for `webular mcp` (--list and serve register the same defs, so the
// two surfaces cannot drift). run() re-parses with the same zod schema for
// defense in depth; a throwing tool becomes isError content, never a protocol
// failure.
//
// Token rules: tools sorted by id with static descriptions (a byte-stable
// tools/list keeps client prompt caches warm); results are sorted-key compact
// JSON, narrowed by `fields`, paged under PAGE_MAX_CHARS with an opaque
// `cursor`; errors are one short line.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { fetchText } from '../core/http.ts'
import { pageText, selectFields, shortError, stableJson } from '../core/output.ts'
import { extractLinks, htmlToArticle, htmlToMarkdown } from '../lib/html.ts'

interface McpToolDef {
  id: string
  description: string
  schema: z.ZodObject<z.ZodRawShape>
  run(args: Record<string, unknown>): Promise<unknown>
}

const paging = {
  cursor: z.string().optional().describe('nextCursor from the previous page'),
  fields: z.array(z.string()).optional().describe('Top-level result fields to keep'),
}
const pagingSchema = z.object(paging)
const fetchSchema = z.object({
  url: z.string().url(),
  timeoutMs: z.number().int().positive().optional(),
  ...paging,
})
const readabilitySchema = z.object({ html: z.string(), ...paging })
const markdownSchema = z.object({ html: z.string(), ...paging })
const linksSchema = z.object({
  html: z.string(),
  base: z.string().url(),
  limit: z.number().int().min(1).max(1000).optional(),
  ...paging,
})

// Sorted by id: registration order is tools/list order.
export const webTools: McpToolDef[] = [
  {
    id: 'web.fetch',
    description: 'Fetch a URL and return its raw HTML (Bun.fetch).',
    schema: fetchSchema,
    run: async (args) => {
      const { url, timeoutMs } = fetchSchema.parse(args)
      return { url, html: await fetchText(url, { timeoutMs }) }
    },
  },
  {
    id: 'web.links',
    description: 'Extract absolute links from HTML (linkedom document parse).',
    schema: linksSchema,
    run: async (args) => {
      const { html, base, limit } = linksSchema.parse(args)
      return { links: extractLinks(html, base).slice(0, limit) }
    },
  },
  {
    id: 'web.markdown',
    description: 'Convert HTML to Markdown (Turndown).',
    schema: markdownSchema,
    run: async (args) => ({ markdown: htmlToMarkdown(markdownSchema.parse(args).html) }),
  },
  {
    id: 'web.readability',
    description: 'Extract main article content (Mozilla Readability + linkedom).',
    schema: readabilitySchema,
    run: async (args) => htmlToArticle(readabilitySchema.parse(args).html),
  },
]

interface McpText {
  [key: string]: unknown
  content: { type: 'text'; text: string }[]
  isError?: boolean
}

const failure = (text: string): McpText => ({ content: [{ type: 'text', text }], isError: true })

// ponytail: each page re-runs the tool; web.fetch pages lean on the HTTP cache.
async function execute(tool: McpToolDef, args: Record<string, unknown>): Promise<McpText> {
  try {
    const { cursor, fields } = pagingSchema.parse(args)
    const page = pageText(stableJson(selectFields(await tool.run(args), fields)), cursor)
    if (!page.ok) return failure(page.error)
    const content: McpText['content'] = [{ type: 'text', text: page.text }]
    if (page.nextCursor) {
      const more = { nextCursor: page.nextCursor, totalChars: page.totalChars }
      content.push({ type: 'text', text: stableJson(more) })
    }
    return { content }
  } catch (err) {
    return failure(shortError(err))
  }
}

export function registerAll(server: McpServer): void {
  for (const tool of webTools) {
    server.registerTool(
      tool.id,
      { description: tool.description, inputSchema: tool.schema.shape },
      (args: Record<string, unknown>) => execute(tool, args),
    )
  }
}
