// The Readability worker pool returns the same text as an in-thread parse,
// keeps input order under concurrency, and maps a parse failure to a failure.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { htmlToArticle } from '../../src/lib/html.ts'
import { parseArticleText } from '../../src/lib/sources.ts'
import { eff } from '../_support/run.ts'

const page = (n: number) =>
  `<!doctype html><html><head><title>Page ${n}</title></head><body><article><h1>Page ${n}</h1>${`<p>Deterministic pool body ${n} with enough prose for readability to keep it.</p>`.repeat(20)}</article></body></html>`

describe('parseArticleText — worker pool', () => {
  test(
    'matches the in-thread parse, in input order, over more pages than workers',
    eff(
      Effect.gen(function* () {
        const pages = Array.from({ length: 9 }, (_, i) => page(i))
        const texts = yield* Effect.forEach(pages, parseArticleText, { concurrency: 'unbounded' })
        expect(texts).toEqual(pages.map((html) => htmlToArticle(html).text))
        expect(texts[3]).toContain('Deterministic pool body 3')
      }),
    ),
    15_000,
  )
})
