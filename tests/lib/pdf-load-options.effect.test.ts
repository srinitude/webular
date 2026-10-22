// The PDF load caps pdf.js image size, the loaded proxy is destroyed after the read,
// and WEBULAR_PDF_TIMEOUT_MS bounds the load too: a load that never settles fails
// with the timeout note instead of hanging.
// One file, one mock.module: Bun keeps the first mock of a module for the whole
// process, so a second file mocking unpdf would get this file's mock.
import { afterAll, expect, mock, test } from 'bun:test'
import { ConfigProvider, Effect } from 'effect'
import * as realUnpdf from 'unpdf'
import { pdfText } from '../../src/lib/parse.ts'
import { eff, failMsg } from '../_support/run.ts'

const seen: { options: unknown; destroyed: number; hang: boolean } = {
  options: undefined,
  destroyed: 0,
  hang: false,
}
mock.module('unpdf', () => ({
  ...realUnpdf,
  getDocumentProxy: (_data: unknown, options: unknown) => {
    seen.options = options
    // unpdf's mocked API returns a Promise: build it from an Effect.
    if (seen.hang) return Effect.runPromise(Effect.never)
    return Effect.runPromise(
      Effect.succeed({
        numPages: 0,
        loadingTask: {
          destroy: () =>
            Effect.runPromise(
              Effect.sync(() => {
                seen.destroyed += 1
              }),
            ),
        },
      }),
    )
  },
}))
afterAll(() => mock.module('unpdf', () => realUnpdf))

const withEnv = (env: Record<string, string>) =>
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env }))

test(
  'getDocumentProxy gets maxImageSize and the proxy is destroyed',
  eff(
    Effect.gen(function* () {
      seen.hang = false
      yield* Effect.exit(pdfText(new Uint8Array([1, 2, 3])))
      expect(seen.options).toEqual({ maxImageSize: 16_777_216 })
      expect(seen.destroyed).toBe(1)
    }),
  ),
  5_000,
)

test(
  'a PDF load that hangs fails at WEBULAR_PDF_TIMEOUT_MS',
  eff(
    Effect.gen(function* () {
      seen.hang = true
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
