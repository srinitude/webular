import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { type SourceRunner, searchEffect } from '../../src/lib/search-chain.ts'
import { applyConstraints, parseQuery, queryPlan } from '../../src/lib/search-query.ts'
import { eff } from '../_support/run.ts'

const NOW = '2026-10-22'
const sync = (body: () => void) => eff(Effect.sync(body))

test(
  'a well-formed query comes back unchanged',
  sync(() => {
    expect(parseQuery('effect ts layers guide', NOW).keyword).toBe('effect ts layers guide')
    expect(parseQuery('The Who greatest hits', NOW).keyword).toBe('The Who greatest hits')
    expect(queryPlan('effect ts layers guide', NOW)).toEqual({
      query: 'effect ts layers guide',
      variants: [],
    })
  }),
)

test(
  'a question loses its filler and keeps its keywords',
  sync(() => {
    expect(parseQuery('What is the capital of France?', NOW).keyword).toBe('capital of France')
    expect(parseQuery('Can you please tell me about bun test runner', NOW).keyword).toBe(
      'bun test runner',
    )
  }),
)

test(
  'site, year, and negation constraints are read and removed from the keywords',
  sync(() => {
    const p = parseQuery('rust async site:www.Example.com since 2023 -tokio', NOW)
    expect(p.keyword).toBe('rust async')
    expect(p.constraints).toEqual({ site: 'example.com', since: 2023, exclude: ['tokio'] })
    expect(parseQuery('jaguar speed -car', NOW).constraints.exclude).toEqual(['car'])
    expect(parseQuery('state-of-the-art models', NOW).constraints.exclude).toEqual([])
    // Only the explicit operator negates: "without" names what the user wants.
    const fanless = parseQuery('laptops without fans', NOW)
    expect(fanless.constraints.exclude).toEqual([])
    const hits = [{ title: 'Best laptops without fans', url: 'https://a.test/', description: '' }]
    expect(applyConstraints(hits, fanless.constraints)).toEqual(hits)
    expect(parseQuery('election results in 2024', NOW).constraints).toMatchObject({
      since: 2024,
      until: 2024,
    })
    expect(parseQuery('papers before 2020', NOW).constraints.until).toBe(2020)
    expect(parseQuery('ai news last year', NOW).constraints).toMatchObject({
      since: 2025,
      until: 2025,
    })
  }),
)

test(
  'the keyword form goes first, the original stays, repeats are dropped',
  sync(() => {
    const plan = queryPlan('What is the capital of France?', NOW, [
      'capital of france',
      'Paris capital',
    ])
    expect(plan.query).toBe('capital of France')
    expect(plan.variants).toEqual(['What is the capital of France?', 'Paris capital'])
    expect(queryPlan('a b', NOW, ['a b', 'A  B', 'c'])).toEqual({ query: 'a b', variants: ['c'] })
  }),
)

test(
  'constraints filter hits before they reach fusion',
  sync(() => {
    const hit = (url: string, title: string, description = '') => ({ url, title, description })
    const hits = [
      hit('https://docs.example.com/a', 'Async 2024'),
      hit('https://other.com/b', 'Async 2024'),
      hit('https://example.com/c', 'Async with tokio 2024'),
      hit('https://example.com/d', 'Async 2019'),
      hit('https://example.com/e', 'Async basics'),
    ]
    const { constraints } = parseQuery('async site:example.com since 2023 -tokio', NOW)
    expect(applyConstraints(hits, constraints).map((h) => h.url)).toEqual([
      'https://docs.example.com/a',
      'https://example.com/e',
    ])
  }),
)

const mixed: SourceRunner = () =>
  Effect.succeed([
    { title: 'Bun runtime', url: 'https://other.com/bun', description: '' },
    { title: 'Bun runtime docs', url: 'https://example.com/bun', description: '' },
  ])

test(
  'site: still filters chain results after the query becomes its keyword form',
  eff(
    Effect.gen(function* () {
      const plan = queryPlan('site:example.com bun runtime', NOW)
      const opts = { runSource: mixed, variants: plan.variants }
      const { results } = yield* searchEffect('wikipedia', plan.query, 5, opts)
      expect(results.map((h) => h.url)).toEqual(['https://example.com/bun'])
    }),
  ),
)
