// SCRAPE workflow: fetch → main-content extract → markdown, composed as a
// Mastra non-model workflow over FOSS tools.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { fetchText } from '../core/http.ts'
import { htmlToMarkdown, parsePage } from '../lib/html.ts'

const scrapeInput = z.object({
  url: z.string().url(),
  timeoutMs: z.number().optional(),
})

const scrapeOutput = z.object({
  url: z.string(),
  title: z.string(),
  markdown: z.string(),
  text: z.string(),
  links: z.array(z.string()),
})

const fetchStep = createStep({
  id: 'fetch',
  inputSchema: scrapeInput,
  outputSchema: z.object({ url: z.string(), html: z.string() }),
  execute: async ({ inputData }) => ({
    url: inputData.url,
    html: await fetchText(inputData.url, { timeoutMs: inputData.timeoutMs }),
  }),
})

function toScrapeResult(url: string, html: string): z.infer<typeof scrapeOutput> {
  const page = parsePage(html, url)
  const body = htmlToMarkdown(page.article.contentHtml || html)
  return {
    url,
    title: page.title,
    markdown: page.title ? `# ${page.title}\n\n${body}` : body,
    text: page.article.text,
    links: page.links,
  }
}

const extractStep = createStep({
  id: 'extract',
  inputSchema: z.object({ url: z.string(), html: z.string() }),
  outputSchema: scrapeOutput,
  execute: async ({ inputData }) => toScrapeResult(inputData.url, inputData.html),
})

export const scrapeWorkflow = createWorkflow({
  id: 'scrape',
  inputSchema: scrapeInput,
  outputSchema: scrapeOutput,
})
  .then(fetchStep)
  .then(extractStep)
  .commit()
