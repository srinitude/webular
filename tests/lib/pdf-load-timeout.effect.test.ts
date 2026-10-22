// WEBULAR_PDF_TIMEOUT_MS bounds loading the PDF too, not only reading its pages:
// a load that never settles fails with the timeout note instead of hanging.
import { afterAll, expect, mock, test } from 'bun:test'
import { ConfigProvider, Effect } from 'effect'
import * as realUnpdf from 'unpdf'
import { pdfText } from '../../src/lib/parse.ts'
import { eff, failMsg } from '../_support/run.ts'

mock.module('unpdf', () => ({
  ...realUnpdf,
  getDocumentProxy: () => new Promise<never>(() => {}),
}))
afterAll(() => mock.module('unpdf', () => realUnpdf))

const withEnv = (env: Record<string, string>) =>
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env }))

test(
  'a PDF load that hangs fails at WEBULAR_PDF_TIMEOUT_MS',
  eff(
    Effect.gen(function* () {
      const run = pdfText(new Uint8Array([1, 2, 3])).pipe(
        withEnv({ WEBULAR_PDF_TIMEOUT_MS: '100' }),
      )
      expect(yield* failMsg(run)).toBe(
        'parse: PDF text stopped before page 1 (WEBULAR_PDF_TIMEOUT_MS: over 100 ms)',
      )
    }),
  ),
  5_000,
)
