// The PDF page cap (2,000 by default) and deadline (60 s by default) bound one
// PDF's text extraction; WEBULAR_PDF_MAX_PAGES and WEBULAR_PDF_TIMEOUT_MS override them.
// Either one stops early with the pages read and a truncation note; only a stop
// before page 1 fails.
import { expect, test } from 'bun:test'
import { ConfigProvider, Effect } from 'effect'
import { pdfText } from '../../src/lib/parse.ts'
import { textPdf } from '../_support/pdf-fixture.ts'
import { eff, failMsg } from '../_support/run.ts'

const withEnv = (env: Record<string, string>) =>
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env }))

test(
  'the default cap reads 2,000 pages of a 2,001-page PDF and notes the cap',
  eff(
    Effect.gen(function* () {
      const text = yield* pdfText(textPdf(2_001)).pipe(withEnv({}))
      expect(text).toContain('page 2000\n\n')
      expect(text).not.toContain('page 2001')
      expect(text).toEndWith(
        '[truncated at page 2000 of 2001 (WEBULAR_PDF_MAX_PAGES: 2000-page cap)]',
      )
      expect(yield* pdfText(textPdf(20)).pipe(withEnv({}))).not.toContain('truncated')
    }),
  ),
)

test(
  'WEBULAR_PDF_MAX_PAGES lowers the cap; a cap of 0 reads no page and fails',
  eff(
    Effect.gen(function* () {
      const text = yield* pdfText(textPdf(3)).pipe(withEnv({ WEBULAR_PDF_MAX_PAGES: '2' }))
      expect(text).toBe(
        'page 1\npage 2\n\n[truncated at page 2 of 3 (WEBULAR_PDF_MAX_PAGES: 2-page cap)]',
      )
      const none = pdfText(textPdf(3)).pipe(withEnv({ WEBULAR_PDF_MAX_PAGES: '0' }))
      expect(yield* failMsg(none)).toBe(
        'parse: PDF text stopped before page 1 (WEBULAR_PDF_MAX_PAGES: 0-page cap)',
      )
    }),
  ),
)

test(
  'WEBULAR_PDF_TIMEOUT_MS stops mid-document with the pages read and a note',
  eff(
    Effect.gen(function* () {
      const text = yield* pdfText(textPdf(2_000)).pipe(withEnv({ WEBULAR_PDF_TIMEOUT_MS: '50' }))
      const reached = /\[truncated at page (\d+) of 2000 \(WEBULAR_PDF_TIMEOUT_MS: over 50 ms\)\]$/
      const page = Number(text.match(reached)?.[1])
      expect(page).toBeGreaterThan(0)
      expect(page).toBeLessThan(2_000)
      expect(text).toStartWith('page 1\n')
      expect(text).toContain(`page ${page}\n\n`)
    }),
  ),
)

test(
  'WEBULAR_PDF_TIMEOUT_MS of 0 fires at the first yield, after page 1',
  eff(
    Effect.gen(function* () {
      const text = yield* pdfText(textPdf(500)).pipe(withEnv({ WEBULAR_PDF_TIMEOUT_MS: '0' }))
      expect(text).toBe(
        'page 1\n\n[truncated at page 1 of 500 (WEBULAR_PDF_TIMEOUT_MS: over 0 ms)]',
      )
    }),
  ),
)
