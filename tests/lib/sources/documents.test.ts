// anydoc document conversion on real bytes: a small RTF file converts to
// Markdown locally, and bytes in no known format fail with a typed code.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import {
  anydocUnsupportedPlatform,
  documentToMarkdown,
} from '../../../src/lib/sources/documents.ts'

const bytes = (name: string) =>
  Effect.promise(() => Bun.file(`${import.meta.dir}/../../fixtures/sources/${name}`).bytes())

const rtfCase = Effect.gen(function* () {
  const markdown = yield* documentToMarkdown(yield* bytes('hello.rtf'))
  expect(markdown).toContain('Hello **bold** world.')
})

const unknownCase = Effect.gen(function* () {
  const error = yield* Effect.flip(documentToMarkdown(new TextEncoder().encode('\u0000\u0001')))
  expect(error._tag).toBe('DocumentConvertError')
  expect(error.code).toBe('unsupported')
})

// Skipped on win32-arm64: anydoc ships no binary for it.
const testWithAnydoc = test.skipIf(anydocUnsupportedPlatform)

describe('documentToMarkdown', () => {
  test.if(anydocUnsupportedPlatform)(
    'win32-arm64 fails with a typed unsupportedPlatform error',
    () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const error = yield* Effect.flip(documentToMarkdown(new Uint8Array()))
          expect(error.code).toBe('unsupportedPlatform')
        }),
      ),
  )
  testWithAnydoc('converts an RTF file to Markdown', () => Effect.runPromise(rtfCase))
  testWithAnydoc('unknown bytes fail with code unsupported', () => Effect.runPromise(unknownCase))
})
