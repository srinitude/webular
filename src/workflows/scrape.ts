// SCRAPE workflow: fetch → main-content extract → markdown, composed as a
// Mastra non-model workflow over FOSS tools.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { Effect } from 'effect'
import { z } from 'zod'
import { fetchTextOrArchive } from '../core/archive.ts'
import { fetchTextEffect } from '../core/http.ts'
import { runtime } from '../core/runtime.ts'
import { htmlToMarkdown, parsePage } from '../lib/html.ts'

const scrapeInput = z.object({
  url: z.string().url(),
  timeoutMs: z.number().optional(),
  // Dead page (404, 410, 5xx, network error, timeout) → Wayback raw capture.
  archive: z.boolean().optional(),
})

const scrapeOutput = z.object({
  url: z.string(),
  title: z.string(),
  markdown: z.string(),
  text: z.string(),
  links: z.array(z.string()),
  archivedFrom: z.string().optional(),
})

const fetched = z.object({ url: z.string(), html: z.string(), archivedFrom: z.string().optional() })

const fetchPage = ({ url, timeoutMs, archive }: z.infer<typeof scrapeInput>) =>
  archive
    ? fetchTextOrArchive(url, { timeoutMs })
    : Effect.map(fetchTextEffect(url, { timeoutMs }), (html) => ({ html }))

const fetchStep = createStep({
  id: 'fetch',
  inputSchema: scrapeInput,
  outputSchema: fetched,
  execute: ({ inputData }) =>
    runtime.runPromise(Effect.map(fetchPage(inputData), (r) => ({ url: inputData.url, ...r }))),
})

function toScrapeResult({
  url,
  html,
  archivedFrom,
}: z.infer<typeof fetched>): z.infer<typeof scrapeOutput> {
  const page = parsePage(html, url)
  const body = htmlToMarkdown(page.article.contentHtml || html)
  return {
    url,
    title: page.title,
    markdown: page.title ? `# ${page.title}\n\n${body}` : body,
    text: page.article.text,
    links: page.links,
    ...(archivedFrom ? { archivedFrom } : {}),
  }
}

const extractStep = createStep({
  id: 'extract',
  inputSchema: fetched,
  outputSchema: scrapeOutput,
  execute: ({ inputData }) => Promise.resolve(toScrapeResult(inputData)),
})

export const scrapeWorkflow = createWorkflow({
  id: 'scrape',
  inputSchema: scrapeInput,
  outputSchema: scrapeOutput,
})
  .then(fetchStep)
  .then(extractStep)
  .commit()
