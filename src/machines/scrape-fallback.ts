// Scrape fallbacks (src/workflows/scrape-fallback.ts, called from scrape.ts):
// the plain fetch either returns a page or is refused as a PDF; a page whose
// main text is a script shell renders in the background driver unless render
// is 'off'; a failed render keeps the fetched page; a refused PDF reads
// through the parse reader. Final states: the page as fetched (`fetchedPage`,
// `keptFetched`), the rendered page, the PDF text, or a failure.
import { setup } from 'xstate'

export const scrapeFallbackMachine = setup({
  types: {
    events: {} as
      | { type: 'FETCHED' }
      | { type: 'PDF_REFUSED' }
      | { type: 'FETCH_FAILED' }
      | { type: 'STATIC_PAGE' }
      | { type: 'SHELL_RENDER_OFF' }
      | { type: 'SHELL_RENDER_ON' }
      | { type: 'RENDER_OK' }
      | { type: 'RENDER_FAILED' }
      | { type: 'PDF_OK' }
      | { type: 'PDF_FAILED' },
  },
}).createMachine({
  id: 'scrapeFallback',
  initial: 'fetching',
  states: {
    fetching: {
      on: { FETCHED: 'checkingShell', PDF_REFUSED: 'readingPdf', FETCH_FAILED: 'failed' },
    },
    checkingShell: {
      on: {
        STATIC_PAGE: 'fetchedPage',
        SHELL_RENDER_OFF: 'fetchedPage',
        SHELL_RENDER_ON: 'rendering',
      },
    },
    rendering: { on: { RENDER_OK: 'rendered', RENDER_FAILED: 'keptFetched' } },
    readingPdf: { on: { PDF_OK: 'pdfRead', PDF_FAILED: 'failed' } },
    fetchedPage: { type: 'final' },
    keptFetched: { type: 'final' },
    rendered: { type: 'final' },
    pdfRead: { type: 'final' },
    failed: { type: 'final' },
  },
})
