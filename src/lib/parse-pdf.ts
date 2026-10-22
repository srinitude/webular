// PDF text through unpdf, bounded by a page cap and a deadline.
import { Effect, Option } from 'effect'
import { attempt, fail, ParseError, setting } from './parse-core.ts'

// A page cap and a deadline bound one PDF's text extraction (CPU and memory).
// unpdf reads a dense text page in about 10 ms on an Apple-silicon Mac, so the
// 2,000-page cap takes about 20 s and the 60 s deadline leaves 3x headroom for
// heavier pages and slower hosts. 2,000 pages covers 10-K filings and most long
// government reports. WEBULAR_PDF_MAX_PAGES and WEBULAR_PDF_TIMEOUT_MS override them.
type Pdf = Awaited<ReturnType<typeof import('unpdf').getDocumentProxy>>

// One page's text, joined the way unpdf's extractText joins it.
const pageText = (pdf: Pdf, n: number) =>
  attempt(() => pdf.getPage(n)).pipe(
    Effect.flatMap((page) => attempt(() => page.getTextContent())),
    Effect.map(({ items }) =>
      items.map((it) => ('str' in it ? it.str + (it.hasEOL ? '\n' : '') : '')).join(''),
    ),
  )

// pdf.js extraction runs on promise jobs only, so no timer (the deadline) fires
// mid-document. Reading page by page with a yield between pages lets the
// deadline interrupt, and `texts` keeps every page read before it.
const readPages = (pdf: Pdf, last: number, texts: string[]) =>
  Effect.gen(function* () {
    for (let n = 1; n <= last; n++) {
      texts.push(yield* pageText(pdf, n))
      yield* Effect.yieldNow
    }
  })

// unpdf's mergePages whitespace rules, so output matches a whole-document read.
const merge = (texts: string[]) =>
  texts
    .join('\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')

// The cap or the deadline stops early: the pages read before the stop come back
// with a truncation note naming the setting. Only a stop before page 1 fails.
const readBounded = Effect.fnUntraced(function* (pdf: Pdf, maxPages: number, timeoutMs: number) {
  const texts: string[] = []
  const done = yield* readPages(pdf, Math.min(pdf.numPages, maxPages), texts).pipe(
    Effect.timeoutOption(timeoutMs),
  )
  const text = merge(texts)
  if (texts.length === pdf.numPages) return text
  const stop = Option.isNone(done)
    ? `WEBULAR_PDF_TIMEOUT_MS: over ${timeoutMs} ms`
    : `WEBULAR_PDF_MAX_PAGES: ${maxPages}-page cap`
  if (texts.length === 0) return yield* fail(`parse: PDF text stopped before page 1 (${stop})`)
  return `${text}\n\n[truncated at page ${texts.length} of ${pdf.numPages} (${stop})]`
})

// pdf.js errors read as library internals: name the cause in the parse: voice.
const explain = (e: ParseError) =>
  e.message.startsWith('parse:')
    ? e
    : new ParseError({
        message: /password/i.test(e.message)
          ? 'parse: PDF is password-protected (encrypted); no password is supported'
          : `parse: PDF unreadable: ${e.message}`,
      })

// PDF bytes to text; scrape reads a fetched PDF through this same reader.
export const pdfText = Effect.fnUntraced(function* (bytes: Uint8Array) {
  const maxPages = yield* setting('WEBULAR_PDF_MAX_PAGES', 2_000)
  const timeoutMs = yield* setting('WEBULAR_PDF_TIMEOUT_MS', 60_000)
  const { getDocumentProxy } = yield* attempt(() => import('unpdf'))
  // The pdf.js proxy holds a worker and page buffers: free it on success and failure.
  return yield* Effect.acquireRelease(
    attempt(() => getDocumentProxy(new Uint8Array(bytes))), // a copy: pdf.js detaches its input and rejects a Buffer
    (pdf) =>
      Effect.ignore(attempt(() => (pdf as unknown as { destroy(): Promise<void> }).destroy())),
  ).pipe(
    Effect.flatMap((pdf) => readBounded(pdf, maxPages, timeoutMs)),
    Effect.scoped,
    Effect.mapError(explain),
  )
})
