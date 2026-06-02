// Mastra non-model tools wrapping the FOSS HTML/fetch primitives. These are
// reused by workflows and exposed through the `webular mcp` server.
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { fetchText } from '../core/http.ts'
import { extractLinks, htmlToArticle, htmlToMarkdown } from '../lib/html.ts'

export const fetchTool = createTool({
  id: 'web.fetch',
  description: 'Fetch a URL and return its raw HTML (Bun.fetch).',
  inputSchema: z.object({ url: z.string().url(), timeoutMs: z.number().optional() }),
  outputSchema: z.object({ url: z.string(), html: z.string() }),
  execute: async ({ url, timeoutMs }) => ({ url, html: await fetchText(url, { timeoutMs }) }),
})

export const readabilityTool = createTool({
  id: 'web.readability',
  description: 'Extract main article content (Mozilla Readability + linkedom).',
  inputSchema: z.object({ url: z.string(), html: z.string() }),
  outputSchema: z.object({ title: z.string(), contentHtml: z.string(), text: z.string() }),
  execute: async ({ html }) => htmlToArticle(html),
})

export const markdownTool = createTool({
  id: 'web.markdown',
  description: 'Convert HTML to Markdown (Turndown).',
  inputSchema: z.object({ html: z.string() }),
  outputSchema: z.object({ markdown: z.string() }),
  execute: async ({ html }) => ({ markdown: htmlToMarkdown(html) }),
})

export const linksTool = createTool({
  id: 'web.links',
  description: 'Extract absolute links from HTML (HTMLRewriter-class harvest).',
  inputSchema: z.object({ html: z.string(), base: z.string().url() }),
  outputSchema: z.object({ links: z.array(z.string()) }),
  execute: async ({ html, base }) => ({ links: extractLinks(html, base) }),
})

export const webTools = { fetchTool, readabilityTool, markdownTool, linksTool }
