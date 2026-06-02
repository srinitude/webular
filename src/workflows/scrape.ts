// SCRAPE workflow: fetch → main-content extract → markdown, composed as a
// Mastra non-model workflow over FOSS tools.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { fetchText } from '../core/http.ts'
import { extractLinks, htmlToArticle, htmlToMarkdown } from '../lib/html.ts'

export const scrapeInput = z.object({
  url: z.string().url(),
  timeoutMs: z.number().optional(),
})

export const scrapeOutput = z.object({
  url: z.string(),
  title: z.string(),
  markdown: z.string(),
  text: z.string(),
  links: z.array(z.string()),
  fetchedAt: z.number(),
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
  const article = htmlToArticle(html)
  const body = htmlToMarkdown(article.contentHtml || html)
  return {
    url,
    title: article.title,
    markdown: article.title ? `# ${article.title}\n\n${body}` : body,
    text: article.text,
    links: extractLinks(html, url),
    fetchedAt: Date.now(),
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
