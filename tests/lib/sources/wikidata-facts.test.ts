// The Wikidata SPARQL facts adapter against a real local Bun.serve fixture. The
// body is a hand-built result in the endpoint's JSON shape (no live access to
// record one). The registry is not wired yet, so the fallback case chains a
// failing source and this adapter inside the test. No network, no mocks.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { wikidataFacts } from '../../../src/lib/sources/wikidata-facts.ts'
import { against, body, json, run, serving } from './support.ts'

// The ConfigProvider the fixture installs hides the test preload's env, so the
// disk cache is switched off here too: nothing is written to .cache/webular.

const factsCase = Effect.gen(function* () {
  const text = yield* body('wikidata-sparql.json')
  const ask = wikidataFacts('douglas adams', 3)
  const { out, seen } = yield* serving('/sparql', text, ask)
  expect(out.map((h) => h.url)).toEqual([
    'https://www.wikidata.org/entity/Q42',
    'https://www.wikidata.org/entity/Q4128476',
    'https://www.wikidata.org/entity/Q2013',
  ])
  expect(out[0]?.description).toBe(
    'English science fiction writer and humorist. Instance of: human',
  )
  expect(out[1]?.description).toContain('Country: United States')
  // Two fact rows for one entity collapse into one hit.
  expect(out[2]?.description).toBe(
    'free knowledge base. Instance of: knowledge base, wiki. Inception: 2012-10-29',
  )
  expect(seen.query.get('format')).toBe('json')
  expect(seen.query.get('query')).toContain('mwapi:search "douglas adams"')
  expect(seen.agent).toStartWith('webular/')
})

// Another source fails, so the chain moves on and this one answers.
const fallbackCase = Effect.gen(function* () {
  const text = yield* body('wikidata-sparql.json')
  const chain = Effect.fail('source down').pipe(Effect.catch(() => wikidataFacts('wikidata', 3)))
  const out = yield* against({ '/sparql': () => json(text) }, chain)
  expect(out.length).toBe(3)
})

const refusedCase = Effect.gen(function* () {
  const refusal = new Response('Too Many Requests', { status: 200 })
  const failure = yield* against({ '/sparql': () => refusal }, Effect.flip(wikidataFacts('x', 2)))
  expect(failure).toBeDefined()
})

describe('wikidata facts adapter', () => {
  test('maps entities with their description and key facts', () => run(factsCase), 15_000)
  test('answers when an earlier source fails', () => run(fallbackCase), 15_000)
  test('a non-JSON refusal fails the decode', () => run(refusedCase), 15_000)
})
