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

// The maker's best-linked products come first in Wikidata; the one whose
// description shares the query's words ("terminal emulator") must lead.
const HASHIMOTO = 'official website of the terminal emulator created by Mitchell Hashimoto'
const made = (site: string, name: string, desc: string) => ({
  site: { value: site },
  name: { value: name },
  desc: { value: desc },
})
const hashimoto = JSON.stringify({
  results: {
    bindings: [
      made('https://www.terraform.io/', 'Terraform', 'infrastructure as code software'),
      made('https://www.hashicorp.com/', 'HashiCorp', 'American software company'),
      made('https://www.vagrantup.com/', 'Vagrant', 'software for virtual machine environments'),
      made('https://ghostty.org/', 'Ghostty', 'cross-platform terminal emulator'),
    ],
  },
})
const rankCase = Effect.gen(function* () {
  const { out, seen } = yield* serving('/sparql', hashimoto, creatorProducts(HASHIMOTO, 2))
  expect(out.map((h) => h.url)).toEqual(['https://ghostty.org/', 'https://www.terraform.io/'])
  expect(out[0]?.description).toContain('terminal emulator')
  expect(seen.query.get('query')).toContain('schema:description')
})

// A repeat lookup is answered in-process: one request, no second politeness wait.
// A failed answer is never kept, so the next lookup asks again.
const cacheCase = Effect.gen(function* () {
  let calls = 0
  const route = () => {
    calls += 1
    return calls === 1 ? json('nope', 500) : json(hashimoto)
  }
  const twice = Effect.gen(function* () {
    expect(yield* creatorProducts(HASHIMOTO, 2)).toEqual([])
    const first = yield* creatorProducts(HASHIMOTO, 2)
    const again = yield* creatorProducts(HASHIMOTO, 2)
    return { first, again }
  })
  const { first, again } = yield* against({ '/sparql': route }, twice)
  expect(calls).toBe(2)
  expect(again).toEqual(first)
  expect(first[0]?.url).toBe('https://ghostty.org/')
})

describe('products found by their creator', () => {
  test('the product the query describes leads the maker list', () => run(rankCase), 15_000)
  test('a repeat lookup is cached, a failure is not', () => run(cacheCase), 15_000)
  test('the vite creator query yields vite.dev in the top 5', () => run(viteCase), 15_000)
  test('a failed lookup gives no list', () => run(failureCase), 15_000)
  test('only queries that name a maker', () => {
    expect(creatorOf('terminal emulator made by Mitchell Hashimoto')).toBe('Mitchell Hashimoto')
    expect(creatorOf('Zed code editor homepage')).toBeUndefined()
  })
})
