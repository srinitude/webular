// A query that names a product only by its maker finds the product's official
// site through Wikidata, against a recorded SPARQL body on a local Bun.serve
// fixture. No network, no mocks.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { creatorOf, creatorProducts } from '../../../src/lib/sources/creator-products.ts'
import { against, body, json, run, serving } from './support.ts'

const VITE = 'official website of the build tool created by Evan You'

const viteCase = Effect.gen(function* () {
  const reply = yield* body('wikidata-creator-products.json')
  const { out, seen } = yield* serving('/sparql', reply, creatorProducts(VITE, 5))
  expect(out.slice(0, 5).map((h) => h.url)).toContain('https://vite.dev/')
  expect(new Set(out.map((h) => h.url)).size).toBe(out.length)
  expect(seen.query.get('query')).toContain('"Evan You"@en')
  expect(seen.agent).toContain('mailto:me@example.com')
})

const failureCase = Effect.gen(function* () {
  const out = yield* against({ '/sparql': () => json('nope', 500) }, creatorProducts(VITE, 5))
  expect(out).toEqual([])
})

describe('products found by their creator', () => {
  test('the vite creator query yields vite.dev in the top 5', () => run(viteCase), 15_000)
  test('a failed lookup gives no list', () => run(failureCase), 15_000)
  test('only queries that name a maker', () => {
    expect(creatorOf('terminal emulator made by Mitchell Hashimoto')).toBe('Mitchell Hashimoto')
    expect(creatorOf('Zed code editor homepage')).toBeUndefined()
  })
})
