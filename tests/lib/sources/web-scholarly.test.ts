// Marginalia, Wikidata and Europe PMC adapters, the registry fallback, and the
// per-host gap, against a real local Bun.serve fixture (WEBULAR_SOURCE_ORIGIN,
// given through the ConfigProvider, swaps the origin; the path stays).
// Wikidata and Europe PMC bodies are recorded live responses; Marginalia's is
// built from its documented shape because the live call answered 504. No mocks.
import { describe, expect, test } from 'bun:test'
import { Clock, Effect } from 'effect'
import { GAP_MS, politely } from '../../../src/lib/sources/polite.ts'
import { freeSourceFallback } from '../../../src/lib/sources/registry.ts'
import { europePmc } from '../../../src/lib/sources/scholarly.ts'
import { marginalia, wikidata } from '../../../src/lib/sources/web.ts'
import { against, body, json, run } from './support.ts'

const wikidataCase = Effect.gen(function* () {
  const text = yield* body('wikidata-search.json')
  const seen = { agent: '' }
  const route = (req: Request) => {
    seen.agent = req.headers.get('user-agent') ?? ''
    return json(text)
  }
  const hits = yield* against({ '/w/api.php': route }, wikidata('douglas adams', 2))
  expect(hits.length).toBe(2)
  expect(hits[0]?.url).toStartWith('http://www.wikidata.org/entity/Q')
  expect(seen.agent).toContain('mailto:me@example.com')
})

const europePmcCase = Effect.gen(function* () {
  const text = yield* body('europepmc-search.json')
  const routes = { '/europepmc/webservices/rest/search': () => json(text) }
  const hits = yield* against(routes, europePmc('crispr', 2))
  expect(hits.length).toBe(2)
  expect(hits[0]?.url).toBe('https://doi.org/10.1007/10_2026_363')
  expect(hits[0]?.title.length).toBeGreaterThan(0)
})

const marginaliaCase = Effect.gen(function* () {
  const text = yield* body('marginalia-search.json')
  const routes = { '/search': () => json(text) }
  const hits = yield* against(routes, marginalia('effect typescript', 2))
  expect(hits.map((h) => h.url)).toEqual([
    'https://effect.website/docs/',
    'https://example.org/blog/effect-intro',
  ])
})

const emptyPmc = JSON.stringify({ resultList: { result: [] } })
const oneEntity = JSON.stringify({ search: [{ id: 'Q42', label: 'Douglas Adams' }] })

const fallbackCase = Effect.gen(function* () {
  const routes = {
    '/europepmc/webservices/rest/search': () => json(emptyPmc),
    '/w/api.php': () => json(oneEntity),
  }
  const out = yield* against(routes, freeSourceFallback('research', 'douglas adams', 2))
  expect(out.source).toBe('wikidata')
  expect(out.results[0]?.title).toBe('Douglas Adams')
})

const gapCase = Effect.gen(function* () {
  const start = yield* Clock.currentTimeMillis
  yield* Effect.forEach([1, 2], () => politely('gap.test', Effect.void), {
    concurrency: 2,
    discard: true,
  })
  expect((yield* Clock.currentTimeMillis) - start).toBeGreaterThanOrEqual(GAP_MS)
})

describe('free source adapters', () => {
  test('wikidata maps entities and sends the contact User-Agent', () => run(wikidataCase), 15_000)
  test('europePmc prefers the DOI link', () => run(europePmcCase), 15_000)
  test('marginalia keeps the query in the path', () => run(marginaliaCase), 15_000)
  test('the research fallback skips an empty source', () => run(fallbackCase), 15_000)
  test('politely spaces two requests to one host by the gap', () => run(gapCase), 15_000)
})
