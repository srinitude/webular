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
import { decisions } from '../lib/jev/decisions.ts'
import { decisionStep } from '../lib/jev/steps.ts'
import { stepRuntime } from './runtime.ts'
import { withFallbacks } from './scrape-fallback.ts'

const scrapeInput = z.object({
  url: z.url(),
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
    ? Effect.map(fetchTextOrArchive(url, { timeoutMs }), ({ html, archivedFrom }) =>
        archivedFrom ? { html, archivedFrom } : { html },
      )
    : Effect.map(fetchText(url, { timeoutMs }), (html) => ({ html }))

const fetchPage = (input: z.infer<typeof scrapeInput>) =>
  withFallbacks(input.url, staticFetch(input), input.render ?? 'agent-browser', input.timeoutMs)

const fetchStep = createStep({
  id: 'fetch',
  inputSchema: scrapeInput,
  outputSchema: fetched,
  execute: ({ inputData, abortSignal }) =>
    stepRuntime.runPromise(
      Effect.map(fetchPage(inputData), (r) => ({ url: inputData.url, ...r })),
      {
        signal: abortSignal,
      },
    ),
})

const pdfResult = (url: string, markdown: string): z.infer<typeof scrapeOutput> => ({
  url,
  title: '',
  markdown,
  text: markdown,
  links: [],
})

// The parsed page plus both Markdown candidates; `main` picks which one the result keeps.
const prepareScrape = (input: z.infer<typeof fetched>) => {
  if (input.markdown !== undefined) return { input, page: undefined, article: '', full: '' }
  const page = parsePage(input.html, input.url)
  const article = page.article.contentHtml ? htmlToMarkdown(page.article.contentHtml) : ''
  return { input, page, article, full: htmlToMarkdown(input.html) }
}

type Prepared = ReturnType<typeof prepareScrape>
type Picks = readonly ['article' | 'page' | undefined, string | undefined]

function toScrapeResult(p: Prepared, picks: Picks | undefined): z.infer<typeof scrapeOutput> {
  const { url, archivedFrom, markdown, renderedBy } = p.input
  if (markdown !== undefined || p.page === undefined) return pdfResult(url, markdown ?? '')
  const [main, judgedTitle] = picks ?? [undefined, undefined]
  const body = (main ?? (p.article ? 'article' : 'page')) === 'article' ? p.article : p.full
  const title = judgedTitle ?? p.page.title
  return {
    url,
    title,
    markdown: title ? `# ${title}\n\n${body}` : body,
    text: p.page.article.text,
    links: p.page.links,
    ...(archivedFrom ? { archivedFrom } : {}),
    ...(renderedBy ? { renderedBy } : {}),
  }
}

// PDFs skip Jev. The main pick needs both Markdown candidates; the title pick
// runs only when some candidate differs from the rule's title.
const scrapePicks = (p: Prepared) => {
  if (!p.page) return undefined
  const { title, titles } = p.page
  const main =
    p.article && p.full ? { url: p.input.url, article: p.article, page: p.full } : undefined
  const differs = Object.values(titles).some((t) => t.trim() !== '' && t.trim() !== title.trim())
  const titleIn = differs ? { url: p.input.url, candidates: titles } : undefined
  return main || titleIn ? { main, title: titleIn } : undefined
}

const extractStep = decisionStep({
  id: 'extract',
  inputSchema: fetched,
  outputSchema: scrapeOutput,
  // The main-content pick and the title pick run at once, so the title adds no wait.
  decide: ({ main, title }: NonNullable<ReturnType<typeof scrapePicks>>) =>
    Effect.all([
      main ? decisions.main(main) : Effect.succeed(undefined),
      title ? decisions.pageTitle(title) : Effect.succeed(undefined),
    ] as const),
  prepare: prepareScrape,
  pick: scrapePicks,
  output: toScrapeResult,
})

export const scrapeWorkflow = createWorkflow({
  id: 'scrape',
  inputSchema: scrapeInput,
  outputSchema: scrapeOutput,
  options: { shouldPersistSnapshot: () => false },
})
  .then(fetchStep)
  .then(extractStep)
  .commit()
