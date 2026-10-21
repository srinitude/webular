// SCRAPE workflow: fetch → main-content extract → markdown, composed as a
// Mastra non-model workflow over FOSS tools. A PDF url reads through the parse
// reader, and a page that needs JavaScript renders in the background
// (scrape-fallback.ts).
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { Effect } from 'effect'
import { z } from 'zod'
import { fetchTextOrArchive } from '../core/archive.ts'
import { fetchText } from '../core/http.ts'
import { htmlToMarkdown, parsePage } from '../lib/html.ts'
import { stepRuntime } from './runtime.ts'
import { withFallbacks } from './scrape-fallback.ts'

const scrapeInput = z.object({
  url: z.string().url(),
  timeoutMs: z.number().optional(),
  // Dead page (404, 410, 5xx, network error, timeout) → Wayback raw capture.
  archive: z.boolean().optional(),
  // Page needs JavaScript → render it in the background with this driver.
  render: z.enum(['agent-browser', 'cua', 'off']).optional(),
})

const backends = z.enum(['agent-browser', 'cua'])

const scrapeOutput = z.object({
  url: z.string(),
  title: z.string(),
  markdown: z.string(),
  text: z.string(),
  links: z.array(z.string()),
  archivedFrom: z.string().optional(),
  renderedBy: backends.optional(),
})

const fetched = z.object({
  url: z.string(),
  html: z.string(),
  archivedFrom: z.string().optional(),
  markdown: z.string().optional(),
  renderedBy: backends.optional(),
})

const staticFetch = ({ url, timeoutMs, archive }: z.infer<typeof scrapeInput>) =>
  archive
    ? fetchTextOrArchive(url, { timeoutMs })
    : Effect.map(fetchText(url, { timeoutMs }), (html) => ({ html }))

const fetchPage = (input: z.infer<typeof scrapeInput>) =>
  withFallbacks(input.url, staticFetch(input), input.render ?? 'agent-browser')

const fetchStep = createStep({
  id: 'fetch',
  inputSchema: scrapeInput,
  outputSchema: fetched,
  execute: ({ inputData }) =>
    stepRuntime.runPromise(Effect.map(fetchPage(inputData), (r) => ({ url: inputData.url, ...r }))),
})

const pdfResult = (url: string, markdown: string): z.infer<typeof scrapeOutput> => ({
  url,
  title: '',
  markdown,
  text: markdown,
  links: [],
})

function toScrapeResult(input: z.infer<typeof fetched>): z.infer<typeof scrapeOutput> {
  const { url, html, archivedFrom, markdown, renderedBy } = input
  if (markdown !== undefined) return pdfResult(url, markdown)
  const page = parsePage(html, url)
  const body = htmlToMarkdown(page.article.contentHtml || html)
  return {
    url,
    title: page.title,
    markdown: page.title ? `# ${page.title}\n\n${body}` : body,
    text: page.article.text,
    links: page.links,
    ...(archivedFrom ? { archivedFrom } : {}),
    ...(renderedBy ? { renderedBy } : {}),
  }
}

const extractStep = createStep({
  id: 'extract',
  inputSchema: fetched,
  outputSchema: scrapeOutput,
  execute: ({ inputData }) => stepRuntime.runPromise(Effect.sync(() => toScrapeResult(inputData))),
})

export const scrapeWorkflow = createWorkflow({
  id: 'scrape',
  inputSchema: scrapeInput,
  outputSchema: scrapeOutput,
})
  .then(fetchStep)
  .then(extractStep)
  .commit()
