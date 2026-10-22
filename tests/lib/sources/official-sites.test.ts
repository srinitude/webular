// Official sites from Wikidata P856 for the Wikipedia articles a navigational
// search found, against a real local Bun.serve fixture. No network, no mocks.
import { describe, expect, test } from 'bun:test'
import { Deferred, Effect } from 'effect'
import { TestClock } from 'effect/testing'
import { querySource } from '../../../src/lib/search-source-run.ts'
import {
  isNavigational,
  officialBeside,
  officialSites,
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

// Beside the fan-out: the main query's Wikipedia hits feed the lookup; a
// variant's hits never do, and with no Wikipedia answer `take` gives none.
// `take` waits OFFICIAL_WAIT_MS on the Effect clock; under TestClock that window
// never closes by itself, so only the real local SPARQL reply decides the result.
const frozen = <A, E>(eff: Effect.Effect<A, E>) => Effect.provide(eff, TestClock.layer())
const runner = () => Effect.succeed(hits)
const besideCase = Effect.gen(function* () {
  const flow = Effect.gen(function* () {
    const official = yield* officialBeside('deno official site', runner, 5)
    yield* official.run('hackernews', 'deno official site', 5)
    yield* official.run('wikipedia', 'deno variant', 5)
    yield* official.run('wikipedia', 'deno', 5)
    return yield* official.take
  })
  const { out } = yield* serving('/sparql', reply, frozen(flow))
  expect(out[0]?.map((h) => h.url)).toEqual(['https://nodejs.org', 'https://deno.com'])
})
const noWikiCase = Effect.gen(function* () {
  const official = yield* officialBeside('deno official site', runner, 5)
  yield* official.run('wikipedia', 'deno variant', 5)
  expect(yield* official.take).toEqual([])
})

// The fan-out sends each source the query with its trailing "official website"
// words cut (querySource); that Wikipedia call must still feed the lookup.
const navCoreCase = Effect.gen(function* () {
  const main = 'Deno runtime official website'
  const flow = Effect.gen(function* () {
    const official = yield* officialBeside(main, runner, 5)
    const settle = { hit: yield* Deferred.make<void>(), cutoff: Effect.never }
    yield* querySource('wikipedia', [main], 5, official.run, settle)
    return yield* official.take
  })
  const { out } = yield* serving('/sparql', reply, frozen(flow))
  expect(out[0]?.map((h) => h.url)).toEqual(['https://nodejs.org', 'https://deno.com'])
})

// A navigational query that names a maker: the maker's products come in the
// lookup's one call, so a second Wikidata request never takes the host's slot
// and pushes the lookup past its window (the politeness gap stays 1 s).
const MADE = 'official website of the JavaScript runtime created by Ryan Dahl'
const product = (site: string, name: string, links: string) => ({
  site: { value: site },
  name: { value: name },
  links: { value: links },
})
const both = JSON.stringify({
  results: {
    bindings: [
      product('https://nodejs.org', 'Node.js', '60'),
      product('https://deno.com', 'Deno', '20'),
      row(wiki('Deno (software)').url, 'https://deno.com'),
    ],
  },
})
const makerCase = Effect.gen(function* () {
  let calls = 0
  const flow = Effect.gen(function* () {
    const official = yield* officialBeside(MADE, runner, 5)
    yield* official.run('wikipedia', MADE, 5)
    yield* TestClock.adjust(300) // the rest of the fan-out
    return yield* official.take
  })
  const route = (_: Request, url: URL) => {
    calls += 1
    expect(url.searchParams.get('query')).toContain('"Ryan Dahl"@en')
    return json(both)
  }
  const out = yield* against({ '/sparql': route }, frozen(flow))
  expect(calls).toBe(1)
  expect(out.map((list) => list.map((h) => h.url))).toEqual([
    ['https://deno.com'],
    ['https://nodejs.org', 'https://deno.com'],
  ])
})

describe('official sites from Wikidata', () => {
  test('a named maker rides the same call, inside the window', () => run(makerCase), 15_000)
  test('the main query feeds the lookup beside the fan-out', () => run(besideCase), 15_000)
  test('the fan-out call, trailing nav words cut, feeds the lookup', () => run(navCoreCase), 15_000)
  test('no Wikipedia answer for the main query gives no list', () => run(noWikiCase), 15_000)
  test('maps articles to their first official site, in article order', () => run(sitesCase), 15_000)
  test('a failed lookup gives no list', () => run(failureCase), 15_000)
  test('navigational queries only', () => {
    expect(isNavigational('official website of the CSS framework by Adam Wathan')).toBe(true)
    expect(isNavigational('Zed code editor homepage')).toBe(true)
    expect(isNavigational('Who received the Turing Award for 2023?')).toBe(false)
    expect(isNavigational('capital of Spain')).toBe(false)
  })
})
