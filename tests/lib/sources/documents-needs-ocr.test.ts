// A scanned PDF fails with code needsOcr and keeps anydoc's page list
// (anydoc issue #144), so the caller knows which pages to send to OCR.
import { afterAll, expect, mock, test } from 'bun:test'
import * as realAnydoc from '@firecrawl/anydoc'
import { Effect } from 'effect'
import { documentToMarkdown } from '../../../src/lib/sources/documents.ts'
import { eff } from '../../_support/run.ts'

const needsOcr = Object.assign(new Error('pages need OCR'), {
  code: 'needsOcr',
  pages: [2, 3],
  pageCount: 3,
})

mock.module('@firecrawl/anydoc', () => ({
  ...realAnydoc,
  toMarkdownBytes: () => Effect.runPromise(Effect.fail(needsOcr)),
}))
afterAll(() => mock.module('@firecrawl/anydoc', () => realAnydoc))

test(
  'a scanned PDF names the pages that need OCR',
  eff(
    Effect.gen(function* () {
      const error = yield* Effect.flip(documentToMarkdown(new Uint8Array([1])))
      expect(error.code).toBe('needsOcr')
      expect(error.pages).toEqual([2, 3])
    }),
  ),
)
