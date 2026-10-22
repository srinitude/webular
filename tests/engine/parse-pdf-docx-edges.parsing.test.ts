// PDF and docx edge cases: a Node Buffer is accepted like a Uint8Array, an
// encrypted, corrupt, or textless PDF fails with a plain "parse:" message, and a
// corrupt docx names its file.
import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { Effect, FileSystem } from 'effect'
import { parseDocument, pdfText } from '../../src/lib/parse.ts'
import { textPdf } from '../_support/pdf-fixture.ts'
import { eff, failMsg, tmpDir } from '../_support/run.ts'

const decode = (b: Uint8Array) => new TextDecoder().decode(b)
const encode = (s: string) => new TextEncoder().encode(s)

// A standard-handler /Encrypt dictionary whose user key never matches the empty password.
const encryptedPdf = () =>
  encode(
    decode(textPdf(1))
      .replace('/Root 1 0 R', '/Root 1 0 R /Encrypt 9 0 R /ID [<00112233445566778899aabbccddeeff>]')
      .replace(
        '\nxref',
        `\n9 0 obj\n<< /Filter /Standard /V 1 /R 2 /O <${'ab'.repeat(32)}> /U <${'cd'.repeat(32)}> /P -4 >>\nendobj\nxref`,
      ),
  )

test(
  'a Node Buffer reads like a Uint8Array',
  eff(
    Effect.gen(function* () {
      expect(yield* pdfText(Buffer.from(textPdf(1)))).toBe('page 1')
    }),
  ),
)

// "page 1" drawn as six spaces: same byte length, so the xref stays valid; no text.
const imageOnlyPdf = () => encode(decode(textPdf(1)).replace('(page 1)', '(      )'))

test(
  'an image-only PDF (no text layer) fails and names the OCR next step',
  eff(
    Effect.gen(function* () {
      expect(yield* failMsg(pdfText(imageOnlyPdf()))).toBe(
        'parse: PDF has no text layer (scanned or image-only); webular has no OCR, so run it through an OCR tool such as ocrmypdf first',
      )
    }),
  ),
)

test(
  'an encrypted PDF fails and says it is password-protected',
  eff(
    Effect.gen(function* () {
      expect(yield* failMsg(pdfText(encryptedPdf()))).toBe(
        'parse: PDF is password-protected (encrypted); no password is supported',
      )
    }),
  ),
)

test(
  'a corrupt PDF fails with a parse: message',
  eff(
    Effect.gen(function* () {
      expect(yield* failMsg(pdfText(encode('not a pdf')))).toMatch(/^parse: PDF unreadable: /)
    }),
  ),
)

test(
  'a corrupt docx fails naming the file',
  eff(
    Effect.gen(function* () {
      const file = join(yield* tmpDir('webular-docx-'), 'bad.docx')
      yield* (yield* FileSystem.FileSystem).writeFile(file, encode('not a zip'))
      const msg = yield* failMsg(parseDocument(file))
      expect(msg).toStartWith(`parse: ${file}: docx unreadable: `)
    }),
  ),
)
