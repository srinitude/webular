// The Open Library adapter against a real local Bun.serve fixture. The body is
// shaped like a live search.json answer. No network, no mocks, no disk cache
// (ConfigProvider.fromUnknown replaces the environment, so the cache is switched
// off here, not through the test preload).
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { openLibrary } from '../../../src/lib/sources/books.ts'
import { against, body, json, run } from './support.ts'

const ask = Effect.gen(function* () {
  const text = yield* body('openlibrary-search.json')
  let query = new URLSearchParams()
  const route = (_req: Request, url: URL) => {
    query = url.searchParams
    return json(text)
  }
  const out = yield* against({ '/search.json': route }, openLibrary('dune', 2), {
    WEBULAR_NO_CACHE: '1',
  })
  return { out, query }
})

const adapterCase = Effect.gen(function* () {
  const { out, query } = yield* ask
  expect(out[0]).toEqual({
    title: 'Dune',
    url: 'https://openlibrary.org/works/OL893414W',
    description: 'Frank Herbert, first published 1965',
  })
  expect(query.get('q')).toBe('dune')
  expect(query.get('limit')).toBe('2')
})

// A work with no author and no year still gives a valid hit.
const sparseCase = Effect.gen(function* () {
  const { out } = yield* ask
  expect(out[1]).toEqual({
    title: 'Dune Notes',
    url: 'https://openlibrary.org/works/OL1234567W',
    description: '',
  })
})

describe('Open Library source adapter', () => {
  test('openLibrary maps works to hits with author and year', () => run(adapterCase), 15_000)
  test('a work missing author and year still maps', () => run(sparseCase), 15_000)
})
