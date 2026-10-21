// Scrape fallbacks around the plain fetch (call site: scrape.ts fetchPage):
// - a page whose main content is a script shell renders in the background
//   driver the caller picked (agent-browser or Cua; 'off' skips the render);
// - a PDF that the text fetch refuses reads through the parse reader.
import { Effect } from 'effect'
import { httpGet } from '../core/http.ts'
import { AgentBrowserLive, type Backend, Driver } from '../lib/driver.ts'
import { CuaLive } from '../lib/driver-cua.ts'
import { htmlToArticle } from '../lib/html.ts'
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

// A failed render keeps the fetched page, so a render never loses content.
const rendered = (url: string, page: Page, render: Backend | 'off') =>
  render === 'off' || !needsJs(page.html)
    ? Effect.succeed(page)
    : Effect.orElseSucceed(
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
) =>
  Effect.catchIf(
    Effect.flatMap(fetch, (page) => rendered(url, page, render)),
    isPdfRefusal,
    () => Effect.map(readPdf(url), (markdown) => ({ html: '', markdown })),
  )
