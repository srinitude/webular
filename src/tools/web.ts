// MCP tool definitions wrapping the FOSS HTML/fetch primitives — the single
// source for `webular mcp` (--list and serve register the same defs, so the
// two surfaces cannot drift). run() re-parses with the same zod schema for
// defense in depth; a throwing tool becomes isError content, never a protocol
// failure.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { fetchText } from '../core/http.ts'
import { errMsg } from '../core/output.ts'
import { extractLinks, htmlToArticle, htmlToMarkdown } from '../lib/html.ts'

interface McpToolDef {
  id: string
  description: string
  schema: z.ZodObject<z.ZodRawShape>
  run(args: Record<string, unknown>): Promise<unknown>
}

const fetchSchema = z.object({ url: z.string().url(), timeoutMs: z.number().optional() })
const readabilitySchema = z.object({ html: z.string() })
const markdownSchema = z.object({ html: z.string() })
const linksSchema = z.object({ html: z.string(), base: z.string().url() })

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
    id: 'web.readability',
    description: 'Extract main article content (Mozilla Readability + linkedom).',
    schema: readabilitySchema,
    run: async (args) => htmlToArticle(readabilitySchema.parse(args).html),
  },
  {
    id: 'web.markdown',
    description: 'Convert HTML to Markdown (Turndown).',
    schema: markdownSchema,
    run: async (args) => ({ markdown: htmlToMarkdown(markdownSchema.parse(args).html) }),
  },
  {
    id: 'web.links',
    description: 'Extract absolute links from HTML (linkedom document parse).',
    schema: linksSchema,
    run: async (args) => {
      const { html, base } = linksSchema.parse(args)
      return { links: extractLinks(html, base) }
    },
  },
]

interface McpText {
  [key: string]: unknown
  content: { type: 'text'; text: string }[]
  isError?: boolean
}

async function execute(tool: McpToolDef, args: Record<string, unknown>): Promise<McpText> {
  try {
    return { content: [{ type: 'text', text: JSON.stringify(await tool.run(args)) }] }
  } catch (err) {
    return { content: [{ type: 'text', text: errMsg(err) }], isError: true }
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
