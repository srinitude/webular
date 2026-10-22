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

// Running headers and footers, and words split by a line-end hyphen, are the
// body-text errors Bast and Korzen (JCDL 2017) count. A page's first or last line
// is running when its shape (digits ignored) opens or closes at least half of 3+
// pages; it is dropped only when other text stays on that page.
const shape = (line = '') => line.trim().replace(/\d+/g, '#')

const stripRunning = (texts: string[]) => {
  if (texts.length < 3) return texts
  const pages = texts.map((t) => t.trim().split('\n'))
  const seen = new Map<string, number>()
  for (const lines of pages)
    for (const s of new Set([shape(lines[0]), shape(lines.at(-1))]))
      if (s) seen.set(s, (seen.get(s) ?? 0) + 1)
  const running = (line?: string) => (seen.get(shape(line)) ?? 0) * 2 >= pages.length
  return pages.map((lines) => {
    const end = lines.length > 1 && running(lines.at(-1)) ? -1 : lines.length
    const body = lines.slice(0, end)
    return (body.length > 1 && running(body[0]) ? body.slice(1) : body).join('\n')
  })
}

// unpdf's mergePages whitespace rules, then line-end hyphens joined.
// ponytail: a compound broken at its own hyphen ("well-/known") loses the hyphen; a word list would fix it.
const merge = (texts: string[]) =>
  stripRunning(texts)
    .join('\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/([a-z])-\n([a-z])/g, '$1$2')

// The cap or the deadline stops early: the pages read before the stop come back
// with a truncation note naming the setting. Only a stop before page 1 fails.
const readBounded = Effect.fnUntraced(function* (pdf: Pdf, maxPages: number, timeoutMs: number) {
  const texts: string[] = []
  const done = yield* readPages(pdf, Math.min(pdf.numPages, maxPages), texts).pipe(
    Effect.timeoutOption(timeoutMs),
  )
  const text = merge(texts)
  // An image-only (scanned) PDF has no text layer; empty text would read as success.
  if (texts.length === pdf.numPages)
    return text.trim()
      ? text
      : yield* fail(
          'parse: PDF has no text layer (scanned or image-only); webular has no OCR, so run it through an OCR tool such as ocrmypdf first',
        )
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
const LOAD_FLOOR_MS = 1_000

// A load that never settles fails at WEBULAR_PDF_TIMEOUT_MS, floored at
// LOAD_FLOOR_MS: pdf.js loads through timer tasks, so a short page deadline
// (which still always reads page 1) would otherwise fail a healthy load.
// A load that stops early has no proxy to destroy: unpdf's getDocumentProxy
// does not expose its loading task.
// ponytail: fixed floor; give the load its own setting if large PDFs need more.
const loadPdf = (bytes: Uint8Array, timeoutMs: number) =>
  attempt(() => import('unpdf')).pipe(
    // a copy: pdf.js detaches its input and rejects a Buffer
    Effect.flatMap(({ getDocumentProxy }) =>
      attempt(() => getDocumentProxy(new Uint8Array(bytes))),
    ),
    Effect.timeoutOption(Math.max(timeoutMs, LOAD_FLOOR_MS)),
    Effect.flatMap(
      Option.match({
        onNone: () =>
          fail(
            `parse: PDF text stopped before page 1 (WEBULAR_PDF_TIMEOUT_MS: over ${timeoutMs} ms)`,
          ),
        onSome: Effect.succeed,
      }),
    ),
  )

export const pdfText = Effect.fnUntraced(function* (bytes: Uint8Array) {
  const maxPages = yield* setting('WEBULAR_PDF_MAX_PAGES', 2_000)
  const timeoutMs = yield* setting('WEBULAR_PDF_TIMEOUT_MS', 60_000)
  // The pdf.js proxy holds a worker and page buffers: free it on success and failure.
  return yield* Effect.acquireRelease(loadPdf(bytes, timeoutMs), (pdf) =>
    Effect.ignore(attempt(() => (pdf as unknown as { destroy(): Promise<void> }).destroy())),
  ).pipe(
    Effect.flatMap((pdf) => readBounded(pdf, maxPages, timeoutMs)),
    Effect.scoped,
    Effect.mapError(explain),
  )
})
