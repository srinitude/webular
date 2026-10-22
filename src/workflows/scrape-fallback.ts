// Scrape fallbacks around the plain fetch (call site: scrape.ts fetchPage):
// - a page whose main content is a script shell renders in the background
//   driver the caller picked (agent-browser or Cua; 'off' skips the render);
// - a PDF that the text fetch refuses reads through the parse reader.
import { Effect, Stream } from 'effect'
import { collectCapped } from '../core/capped-bytes.ts'
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
// ponytail: a PDF is buffered up to this cap; stream it to disk if larger files matter.
const PDF_MAX_BYTES = 50 * 1024 * 1024

// A full sentence (40+ characters ending in . ! or ?) is real content, so a
// short static page with an analytics script (example.com) skips the render.
const SENTENCE = /\w[^.!?]{39,}[.!?]/
// A short "enable JavaScript" notice is the shell talking, not page content.
const JS_NOTICE = /enable javascript|javascript (is )?(required|disabled)/i
// ponytail: length heuristic on the readable main text; a page that ships
// scripts, under MIN_MAIN_TEXT characters of article text, and no full
// sentence (or only a JavaScript notice) gets a render.
const isShell = (html: string, text: string) =>
  /<script\b/i.test(html) &&
  text.trim().length < MIN_MAIN_TEXT &&
  (!SENTENCE.test(text) || JS_NOTICE.test(text))
export const needsJs = (html: string) => isShell(html, htmlToArticle(html).text)

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

export const readPdf = (url: string, maxBytes = PDF_MAX_BYTES) =>
  Effect.gen(function* () {
    const res = yield* httpGet(url)
    if (!res.ok || Number(res.headers.get('content-length') ?? 0) > maxBytes) {
      yield* Effect.promise(() => res.body?.cancel() ?? Promise.resolve())
      return yield* Effect.fail(
        new Error(`pdf ${url}: status ${res.status} or over ${maxBytes} bytes`),
      )
    }
    const bytes = yield* collectCapped(
      Stream.fromReadableStream({
        evaluate: () => res.body as ReadableStream<Uint8Array>,
        onError: (err) => new Error(`pdf ${url}: ${String(err)}`),
      }),
      maxBytes,
      () => new Error(`pdf ${url}: exceeded ${maxBytes} bytes`),
    )
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
