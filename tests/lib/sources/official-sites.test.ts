// Official sites from Wikidata P856 for the Wikipedia articles a navigational
// search found, against a real local Bun.serve fixture. No network, no mocks.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import {
  isNavigational,
  officialSites,
  withOfficial,
} from '../../../src/lib/sources/official-sites.ts'
import { against, json, run, serving } from './support.ts'

const wiki = (title: string) => ({
  title,
  url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
  description: '',
})
const hits = [
  wiki('Node.js'),
  { title: 'HN', url: 'https://news.ycombinator.com/item?id=1', description: '' },
  wiki('Ryan Dahl'),
  wiki('Deno (software)'),
]
const row = (a: string, site: string) => ({ a: { value: a }, site: { value: site } })
// Rows come back out of article order, with two sites for Deno.
const reply = JSON.stringify({
  results: {
    bindings: [
      row(wiki('Deno (software)').url, 'https://deno.com'),
      row(wiki('Node.js').url, 'https://nodejs.org'),
      row(wiki('Deno (software)').url, 'https://deno.land'),
    ],
  },
})

const sitesCase = Effect.gen(function* () {
  const { out, seen } = yield* serving('/sparql', reply, officialSites(hits, 5))
  expect(out.length).toBe(1)
  expect(out[0]?.map((h) => h.url)).toEqual(['https://nodejs.org', 'https://deno.com'])
  expect(out[0]?.[1]?.title).toBe('Deno (software)')
  expect(seen.query.get('query')).toContain('<https://en.wikipedia.org/wiki/Deno_(software)>')
  expect(seen.query.get('query')).not.toContain('news.ycombinator.com')
})

const failureCase = Effect.gen(function* () {
  const out = yield* against({ '/sparql': () => json('nope', 500) }, officialSites(hits, 5))
  expect(out).toEqual([])
})

const runner = () => Effect.succeed(hits)

// Inside the settle window: the main query's Wikipedia list (trailing nav words
// cut) leads with the official sites; a variant's list stays as it was.
const insideCase = Effect.gen(function* () {
  const lookup = withOfficial('Deno runtime official website', runner, 5)
  const flow = Effect.all([
    lookup('wikipedia', 'Deno runtime', 5),
    lookup('wikipedia', 'deno variant', 5),
  ])
  const { out } = yield* serving('/sparql', reply, flow)
  expect(out[0].map((h) => h.url).slice(0, 3)).toEqual([
    'https://nodejs.org',
    'https://deno.com',
    'https://en.wikipedia.org/wiki/Node.js',
  ])
  expect(out[1]).toEqual(hits)
})

describe('official sites from Wikidata', () => {
  test(
    "the main query's Wikipedia list leads with its official sites",
    () => run(insideCase),
    15_000,
  )
  test('maps articles to their first official site, in article order', () => run(sitesCase), 15_000)
  test('a failed lookup gives no list', () => run(failureCase), 15_000)
  test('navigational queries only', () => {
    expect(isNavigational('official website of the CSS framework by Adam Wathan')).toBe(true)
    expect(isNavigational('Zed code editor homepage')).toBe(true)
    expect(isNavigational('Who received the Turing Award for 2023?')).toBe(false)
    expect(isNavigational('capital of Spain')).toBe(false)
  })
})
