// anydoc on a small local RTF file: paragraphs and italics become Markdown
// with no network.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { documentToMarkdown } from '../../../src/lib/sources/documents.ts'

const rtf = Effect.promise(() =>
  Bun.file(`${import.meta.dir}/../../fixtures/sources/two-paragraphs.rtf`).bytes(),
)

test('an RTF file converts to two Markdown paragraphs with italics', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const markdown = yield* documentToMarkdown(yield* rtf)
      expect(markdown).toBe('First paragraph with *italic* text.\n\nSecond paragraph.\n')
    }),
  ))
