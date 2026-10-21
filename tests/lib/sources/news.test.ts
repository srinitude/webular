// Hacker News (Algolia) and GDELT adapters, and the summarize fallback that
// reaches them, against a real local Bun.serve fixture. Both bodies are
// recorded live responses. No network, no mocks.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { gdelt, hnAlgolia } from '../../../src/lib/sources/news.ts'
import { freeSourceFallback } from '../../../src/lib/sources/registry.ts'
import { against, body, json, run, serving } from './support.ts'

const hnCase = Effect.gen(function* () {
  const text = yield* body('hn-algolia-search.json')
  const { out, seen } = yield* serving('/api/v1/search', text, hnAlgolia('effect typescript', 2))
  expect(out.length).toBe(2)
  expect(out[0]?.url).toStartWith('https://')
  expect(out[0]?.published).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  expect(seen.query.get('tags')).toBe('story')
})

const gdeltCase = Effect.gen(function* () {
  const text = yield* body('gdelt-doc.json')
  const { out, seen } = yield* serving('/api/v2/doc/doc', text, gdelt('"open source"', 2))
  expect(out.length).toBe(2)
  expect(Date.parse(out[0]?.published ?? '')).toBeGreaterThan(0)
  expect(seen.query.get('mode')).toBe('artlist')
})

const emptyEntities = JSON.stringify({ search: [] })

// Wikidata answers empty and GDELT refuses in plain text, so Hacker News wins.
const fallbackCase = Effect.gen(function* () {
  const text = yield* body('hn-algolia-search.json')
  const routes = {
    '/w/api.php': () => json(emptyEntities),
    '/api/v2/doc/doc': () => new Response('Please limit requests', { status: 200 }),
    '/api/v1/search': () => json(text),
  }
  const out = yield* against(routes, freeSourceFallback('summarize', 'effect typescript', 2))
  expect(out.source).toBe('hn-algolia')
  expect(out.failures.map((f) => f.source).sort()).toEqual(['gdelt', 'wikidata'])
})

describe('news source adapters', () => {
  test('hnAlgolia maps stories with their dates', () => run(hnCase), 15_000)
  test('gdelt turns its compact dates into ISO dates', () => run(gdeltCase), 15_000)
  test(
    'the summarize fallback skips an empty and a refusing source',
    () => run(fallbackCase),
    15_000,
  )
})
