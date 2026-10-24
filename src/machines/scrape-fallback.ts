// Scrape fallbacks (src/workflows/scrape-fallback.ts, called from scrape.ts):
// robots.txt runs first, and a block (without ignoreRobots) skips the fetch and
// every fallback; with `archive`, a dead page is served from its Wayback
// capture; the plain fetch either returns a page or is refused as a PDF; a page whose
// main text is a script shell renders in the background driver unless render
// is 'off'; a failed render keeps the fetched page; a refused PDF reads
// through the parse reader, and a PDF with no text layer (scanned) is
// PDF_FAILED. Final states: the page as fetched (`fetchedPage`, `keptFetched`),
// the rendered page, the PDF text, a robots block, or a failure.
// tests/machines/machine-sync.test.ts ties each event to its branch in the code.
import { setup, types } from 'xstate'

export const scrapeFallbackMachine = setup({
  schemas: {
    events: {
      ROBOTS_BLOCKED: types<void>(),
      FETCHED: types<void>(),
      ARCHIVED: types<void>(),
      PDF_REFUSED: types<void>(),
      FETCH_FAILED: types<void>(),
      STATIC_PAGE: types<void>(),
      SHELL_RENDER_OFF: types<void>(),
      SHELL_RENDER_ON: types<void>(),
      RENDER_OK: types<void>(),
      RENDER_FAILED: types<void>(),
      PDF_OK: types<void>(),
      PDF_FAILED: types<void>(),
    },
  },
}).createMachine({
  id: 'scrapeFallback',
  initial: 'fetching',
  states: {
    fetching: {
      on: {
        ROBOTS_BLOCKED: { target: 'robotsBlocked' },
        FETCHED: { target: 'checkingShell' },
        ARCHIVED: { target: 'checkingShell' },
        PDF_REFUSED: { target: 'readingPdf' },
        FETCH_FAILED: { target: 'failed' },
      },
    },
    checkingShell: {
      on: {
        STATIC_PAGE: { target: 'fetchedPage' },
        SHELL_RENDER_OFF: { target: 'fetchedPage' },
        SHELL_RENDER_ON: { target: 'rendering' },
      },
    },
    rendering: {
      on: { RENDER_OK: { target: 'rendered' }, RENDER_FAILED: { target: 'keptFetched' } },
    },
    readingPdf: { on: { PDF_OK: { target: 'pdfRead' }, PDF_FAILED: { target: 'failed' } } },
    fetchedPage: { type: 'final' },
    keptFetched: { type: 'final' },
    rendered: { type: 'final' },
    pdfRead: { type: 'final' },
    robotsBlocked: { type: 'final' },
    failed: { type: 'final' },
  },
})
