// SCRAPE workflow: fetch → main-content extract → markdown, composed as a
// Mastra non-model workflow over FOSS tools. A PDF url reads through the parse
// reader, and a page that needs JavaScript renders in the background
// (scrape-fallback.ts).
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { Effect } from 'effect'
import type { z } from 'zod'
import { fetchTextOrArchive } from '../core/archive.ts'
import { type FetchOptions, fetchText } from '../core/http.ts'
import { mdHeading } from '../core/output.ts'
import { htmlToMarkdown, pageBodyHtml, parsePage } from '../lib/html.ts'
import { decisions } from '../lib/jev/decisions.ts'
import { decisionStep } from '../lib/jev/steps.ts'
import {
  hopBlockToRobots,
  isRobotsBlock,
  ROBOTS_AGENT,
  robotsGate,
  robotsHopGate,
} from '../lib/robots-gate.ts'
import { stepRuntime } from './runtime.ts'
import { withFallbacks } from './scrape-fallback.ts'
import { fetched, scrapeInput, scrapeOutput } from './scrape-schemas.ts'

// Every redirect hop obeys robots.txt, even under ignoreRobots (it covers the named url only).
const staticFetch = (
  { url, timeoutMs, archive }: z.infer<typeof scrapeInput>,
  hopGate: NonNullable<FetchOptions['hopGate']>,
) =>
  (archive
    ? Effect.map(fetchTextOrArchive(url, { timeoutMs, hopGate }), ({ html, archivedFrom }) =>
        archivedFrom ? { html, archivedFrom } : { html },
      )
    : Effect.map(fetchText(url, { timeoutMs, hopGate }), (html) => ({ html }))
  ).pipe(Effect.mapError(hopBlockToRobots))

// robots.txt first: a block skips the fetch and every fallback, unless
// ignoreRobots, which marks the page `robots: disallowed`.
const robotsMark = (input: z.infer<typeof scrapeInput>) =>
  Effect.catchIf(Effect.as(robotsGate(input.url), {}), isRobotsBlock, (err) =>
    input.ignoreRobots ? Effect.succeed({ robots: 'disallowed' as const }) : Effect.fail(err),
  )

const fetchPage = (input: z.infer<typeof scrapeInput>) =>
  Effect.flatMap(Effect.all([robotsMark(input), robotsHopGate]), ([mark, hopGate]) =>
    Effect.map(
      withFallbacks(
        input.url,
        staticFetch(input, hopGate),
        input.render ?? 'agent-browser',
        input.timeoutMs,
      ),
      (page) => ({ ...page, ...mark }),
    ),
  ).pipe(
    Effect.catchIf(isRobotsBlock, (err) =>
      Effect.succeed({ html: '', blockedBy: err.rule ?? '/' }),
    ),
  )

const fetchStep = createStep({
  id: 'fetch',
  inputSchema: scrapeInput,
  outputSchema: fetched,
  execute: ({ inputData, abortSignal }) =>
    stepRuntime.runPromise(
      Effect.map(fetchPage(inputData), (r) => ({ url: inputData.url, ...r })),
      { signal: abortSignal },
    ),
})

const pdfResult = (url: string, markdown: string): z.infer<typeof scrapeOutput> => ({
  url,
  title: '',
  markdown,
  text: markdown,
  links: [],
})

const robotsBlocked = (url: string, rule: string): z.infer<typeof scrapeOutput> => ({
  ...pdfResult(url, ''),
  status: 'blocked',
  reason: 'robots',
  rule,
  userAgent: ROBOTS_AGENT,
})

// The parsed page plus both Markdown candidates; `main` picks which one the result keeps.
const prepareScrape = (input: z.infer<typeof fetched>) => {
  if (input.markdown !== undefined || input.blockedBy !== undefined)
    return { input, page: undefined, article: '', full: '' }
  const page = parsePage(input.html, input.url)
  const article = page.article.contentHtml ? htmlToMarkdown(page.article.contentHtml) : ''
  return { input, page, article, full: htmlToMarkdown(pageBodyHtml(input.html)) }
}

type Prepared = ReturnType<typeof prepareScrape>
type Picks = readonly ['article' | 'page' | undefined, string | undefined]

function toScrapeResult(p: Prepared, picks: Picks | undefined): z.infer<typeof scrapeOutput> {
  const { url, archivedFrom, markdown, renderedBy, blockedBy, robots } = p.input
  if (blockedBy !== undefined) return robotsBlocked(url, blockedBy)
  if (markdown !== undefined || p.page === undefined)
    return { ...pdfResult(url, markdown ?? ''), ...(robots ? { robots } : {}) }
  const [main, judgedTitle] = picks ?? [undefined, undefined]
  const body = (main ?? (p.article ? 'article' : 'page')) === 'article' ? p.article : p.full
  const title = judgedTitle ?? p.page.title
  return {
    url,
    title,
    markdown: title ? `# ${mdHeading(title)}\n\n${body}` : body,
    text: p.page.article.text,
    links: p.page.links,
    ...(p.page.metadata ? { metadata: p.page.metadata } : {}),
    ...(archivedFrom ? { archivedFrom } : {}),
    ...(renderedBy ? { renderedBy } : {}),
    ...(robots ? { robots } : {}),
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

// The main-content pick and the title pick run at once, so the title adds no wait.
export const scrapeDecide = ({ main, title }: NonNullable<ReturnType<typeof scrapePicks>>) =>
  Effect.all(
    [
      main ? decisions.main(main) : Effect.succeed(undefined),
      title ? decisions.pageTitle(title) : Effect.succeed(undefined),
    ] as const,
    { concurrency: 2 },
  )

const extractStep = decisionStep({
  id: 'extract',
  inputSchema: fetched,
  outputSchema: scrapeOutput,
  decide: scrapeDecide,
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
