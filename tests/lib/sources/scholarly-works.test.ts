// Crossref and OpenAlex adapters against the local fixture server: the
// WEBULAR_SOURCE_ORIGIN redirect reaches them, so no test calls a live host.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { crossref, openalex } from '../../../src/lib/scholarly.ts'
import { against, body, json, run } from './support.ts'

const crossrefCase = Effect.gen(function* () {
  const text = yield* body('crossref-works.json')
  const seen = { query: new URLSearchParams() }
  const route = (_: Request, url: URL) => {
    seen.query = url.searchParams
    return json(text)
  }
  const hits = yield* against({ '/works': route }, crossref('crispr', 2))
  expect(hits.map((h) => h.url)).toEqual([
    'https://doi.org/10.1000/crispr.1',
    'https://doi.org/10.1000/crispr.2',
  ])
  expect(hits[0]?.title).toBe('CRISPR gene editing')
  expect(hits[0]?.description).toContain('Editing genes')
  expect(seen.query.get('rows')).toBe('2')
  expect(seen.query.get('mailto')).toBe('me@example.com')
})

const openalexCase = Effect.gen(function* () {
  const text = yield* body('openalex-works.json')
  const hits = yield* against({ '/works': () => json(text) }, openalex('crispr', 2))
  expect(hits[0]?.url).toBe('https://doi.org/10.1000/crispr.1')
  expect(hits[0]?.description).toBe('Editing genes works')
  expect(hits[1]?.url).toBe('https://openalex.org/W2')
})

const failureCase = Effect.gen(function* () {
  const down = () => json('{}', 500)
  const exit = yield* Effect.exit(against({ '/works': down }, crossref('crispr', 2)))
  expect(exit._tag).toBe('Failure')
})

describe('crossref and openalex adapters', () => {
  test('crossref maps works and sends mailto', () => run(crossrefCase), 15_000)
  test('openalex un-inverts abstracts and falls back to the id', () => run(openalexCase), 15_000)
  test('a failing host is a typed failure, not a live call', () => run(failureCase), 30_000)
})
