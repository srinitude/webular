// Outcome evals for the tool inputs: every described tool has one input schema,
// a URL field refuses a non-web scheme, and the one shared runtime runs effects.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import descriptions from '../src/descriptions.json' with { type: 'json' }
import { runtime } from '../src/runtime.ts'
import { outputs, schemas } from '../src/schemas.ts'

test('scrape and feed take archive; search takes crossref and openalex', () => {
  const site = 'https://example.com'
  expect(schemas.scrape.safeParse({ url: site, archive: true }).success).toBe(true)
  expect(schemas.feed.safeParse({ url: site, archive: true }).success).toBe(true)
  for (const source of ['crossref', 'openalex'])
    expect(schemas.search.safeParse({ query: 'rag', source }).success).toBe(true)
  expect(schemas.search.safeParse({ query: 'rag', source: 'bing' }).success).toBe(false)
})

test('scrape, feed, and search name the output fields they add only sometimes', () => {
  expect(Object.keys(outputs.scrape?.shape ?? {})).toEqual(['archivedFrom'])
  expect(Object.keys(outputs.feed?.shape ?? {})).toEqual(['feedUrl', 'archivedFrom'])
  expect(outputs.search?.safeParse({ source: 'openalex', results: [] }).success).toBe(true)
})

test('every described tool has exactly one input schema', () => {
  expect(Object.keys(schemas).sort()).toEqual(Object.keys(descriptions.tools).sort())
})

test('a URL input refuses a non-web scheme', () => {
  expect(schemas.scrape.safeParse({ url: 'file:///etc/passwd' }).success).toBe(false)
  expect(schemas.scrape.safeParse({ url: 'https://example.com' }).success).toBe(true)
})

test('the shared runtime runs an effect', () =>
  runtime.runPromise(Effect.sync(() => expect(1).toBe(1))))

test('an input with an unknown key is refused', () => {
  expect(schemas.scrape.safeParse({ url: 'https://example.com', urls: 'x' }).success).toBe(false)
})
