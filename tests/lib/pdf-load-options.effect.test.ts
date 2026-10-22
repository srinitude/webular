// The PDF load caps pdf.js image size, and the loaded proxy is destroyed after the read.
import { afterAll, expect, mock, test } from 'bun:test'
import { Effect } from 'effect'
import * as realUnpdf from 'unpdf'
import { pdfText } from '../../src/lib/parse.ts'
import { eff } from '../_support/run.ts'

const seen: { options: unknown; destroyed: number } = { options: undefined, destroyed: 0 }
mock.module('unpdf', () => ({
  ...realUnpdf,
  getDocumentProxy: (_data: unknown, options: unknown) => {
    seen.options = options
    // unpdf's mocked API returns a Promise: build it from an Effect.
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

test(
  'getDocumentProxy gets maxImageSize and the proxy is destroyed',
  eff(
    Effect.gen(function* () {
      yield* Effect.exit(pdfText(new Uint8Array([1, 2, 3])))
      expect(seen.options).toEqual({ maxImageSize: 16_777_216 })
      expect(seen.destroyed).toBe(1)
    }),
  ),
  5_000,
)
