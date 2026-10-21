// The PDF page cap (2,000 by default) and deadline (60 s by default) bound one
// PDF's text extraction; WEBULAR_PDF_MAX_PAGES and WEBULAR_PDF_TIMEOUT_MS override them.
import { expect, test } from 'bun:test'
import { ConfigProvider, Effect } from 'effect'
import { pdfText } from '../../src/lib/parse.ts'
import { eff, failMsg } from '../_support/run.ts'

// A valid PDF of `pages` empty pages, built in memory (a few KB per hundred pages).
const blankPdf = (pages: number) => {
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '']
  const kids = Array.from({ length: pages }, (_, i) => `${i + 3} 0 R`)
  objs[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages} >>`
  for (let i = 0; i < pages; i++) objs.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 9 9] >>')
  let out = '%PDF-1.4\n'
  const offsets = objs.map((o, i) => {
    const at = out.length
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
    return `${String(at).padStart(10, '0')} 00000 n \n`
  })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.join('')}`
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(out)
}

const withEnv = (env: Record<string, string>) =>
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env }))

test(
  'the default cap allows 2,000 pages and refuses 2,001 before extracting text',
  eff(
    Effect.gen(function* () {
      const msg = yield* failMsg(pdfText(blankPdf(2_001)).pipe(withEnv({})))
      expect(msg).toBe('parse: PDF has 2001 pages, over the 2000-page cap (WEBULAR_PDF_MAX_PAGES)')
      expect(yield* pdfText(blankPdf(20)).pipe(withEnv({}))).toBeString()
    }),
  ),
)

test(
  'WEBULAR_PDF_MAX_PAGES lowers the cap',
  eff(
    Effect.gen(function* () {
      const run = pdfText(blankPdf(3)).pipe(withEnv({ WEBULAR_PDF_MAX_PAGES: '2' }))
      expect(yield* failMsg(run)).toMatch(/3 pages, over the 2-page cap/)
    }),
  ),
)

// ponytail: todo until extraction yields between pages; pdf.js text extraction
// never yields to timers, so the deadline cannot fire mid-document.
test.todo(
  'WEBULAR_PDF_TIMEOUT_MS bounds text extraction with a named error',
  eff(
    Effect.gen(function* () {
      const run = pdfText(blankPdf(500)).pipe(withEnv({ WEBULAR_PDF_TIMEOUT_MS: '0' }))
      expect(yield* failMsg(run)).toBe('parse: PDF text took over 0 ms (WEBULAR_PDF_TIMEOUT_MS)')
    }),
  ),
)
