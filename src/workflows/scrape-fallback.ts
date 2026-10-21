// Scrape fallbacks around the plain fetch (call site: scrape.ts fetchPage):
// - a page whose main content is a script shell renders in the background
//   driver the caller picked (agent-browser or Cua; 'off' skips the render);
// - a PDF that the text fetch refuses reads through the parse reader.
import { Effect } from 'effect'
import { httpGet } from '../core/http.ts'
import { AgentBrowserLive, type Backend, Driver } from '../lib/driver.ts'
import { CuaLive } from '../lib/driver-cua.ts'
import { htmlToArticle } from '../lib/html.ts'
import { withJev } from '../lib/jev/budget.ts'
import { Jev } from '../lib/jev/client.ts'
import { isSoftBlock } from '../lib/jev/fetch.ts'
import { needsBrowser } from '../lib/jev/fetch-browser.ts'
import { pdfText } from '../lib/parse.ts'

const MIN_MAIN_TEXT = 200
// ponytail: a PDF is buffered whole; stream it to disk if larger files matter.
const PDF_MAX_BYTES = 50 * 1024 * 1024

// ponytail: length heuristic on the readable main text; a page that ships
// scripts and under MIN_MAIN_TEXT characters of article text gets a render.
export const needsJs = (html: string) =>
  /<script\b/i.test(html) && htmlToArticle(html).text.trim().length < MIN_MAIN_TEXT

const renderInBackground = (url: string, backend: Backend) =>
  Effect.provide(
    Effect.gen(function* () {
      const driver = yield* Driver
      return (yield* driver.render(url)).html
    }),
    backend === 'cua' ? CuaLive : AgentBrowserLive,
  )

const isPdfRefusal = (err: unknown) =>
  err instanceof Error && err.message.includes('"application/pdf"')

const readPdf = (url: string) =>
  Effect.gen(function* () {
    const res = yield* httpGet(url)
    if (!res.ok || Number(res.headers.get('content-length') ?? 0) > PDF_MAX_BYTES) {
      yield* Effect.promise(() => res.body?.cancel() ?? Promise.resolve())
      return yield* Effect.fail(
        new Error(`pdf ${url}: status ${res.status} or over ${PDF_MAX_BYTES} bytes`),
      )
    }
    const bytes = new Uint8Array(yield* Effect.tryPromise(() => res.arrayBuffer()))
    return yield* pdfText(bytes)
  })

interface Page {
  html: string
  archivedFrom?: string
}

// Jev may add a render the length rule misses: a 200 that is really a block page
// (fetch.block), or a page it reads as a shell or bot check (fetch.browser). With
// Jev off only needsJs decides.
export const wantsRender = (url: string, html: string, timeoutMs: number) =>
  needsJs(html)
    ? Effect.succeed(true)
    : withJev(
        Effect.gen(function* () {
          if (!(yield* Jev).available) return false
          const [blocked, browser] = yield* Effect.all(
            [isSoftBlock(url, html, timeoutMs), needsBrowser(url, html, timeoutMs)],
            { concurrency: 2 },
          )
          return blocked || browser
        }),
      )

// A failed render keeps the fetched page, so a render never loses content.
const rendered = (url: string, page: Page, render: Backend | 'off', timeoutMs: number) =>
  render === 'off'
    ? Effect.succeed(page)
    : Effect.flatMap(wantsRender(url, page.html, timeoutMs), (want) =>
        want ? renderPage(url, page, render) : Effect.succeed(page),
      )

const renderPage = (url: string, page: Page, render: Backend) =>
  Effect.orElseSucceed(
    Effect.map(renderInBackground(url, render), (html) => ({
      ...page,
      html,
      renderedBy: render,
    })),
    () => page,
  )

export const withFallbacks = <E>(
  url: string,
  fetch: Effect.Effect<Page, E>,
  render: Backend | 'off',
  timeoutMs = 30_000,
) =>
  Effect.catchIf(
    Effect.flatMap(fetch, (page) => rendered(url, page, render, timeoutMs)),
    isPdfRefusal,
    () => Effect.map(readPdf(url), (markdown) => ({ html: '', markdown })),
  )
