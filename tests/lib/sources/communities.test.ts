// Stack Exchange, Reddit, and Bluesky adapters against a real local Bun.serve
// fixture (WEBULAR_SOURCE_ORIGIN, given through the ConfigProvider, swaps the
// origin; the path stays). The Stack Exchange body is a recorded live response;
// Reddit and Bluesky bodies follow their documented shape (both answered 403
// to keyless calls). No mocks.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { bluesky, reddit, stackExchange } from '../../../src/lib/sources/communities.ts'
import { body, run, serving } from './support.ts'

const stackExchangeCase = Effect.gen(function* () {
  const text = yield* body('stackexchange-search.json')
  const { out, seen } = yield* serving(
    '/2.3/search/advanced',
    text,
    stackExchange('effect typescript', 2),
  )
  expect(out.length).toBeGreaterThan(0)
  for (const h of out) {
    expect(h.title).not.toContain('&#')
    expect(h.url).toStartWith('https://stackoverflow.com/')
  }
  expect(seen.query.get('site')).toBe('stackoverflow')
  expect(seen.query.get('pagesize')).toBe('2')
  expect(seen.agent).toContain('mailto:me@example.com')
})

const redditCase = Effect.gen(function* () {
  const text = yield* body('reddit-search.json')
  const { out, seen } = yield* serving('/search.json', text, reddit('effect typescript', 2))
  expect(out.length).toBeGreaterThan(0)
  for (const h of out) expect(h.url).toStartWith('https://www.reddit.com/r/')
  expect(seen.query.get('q')).toBe('effect typescript')
})

const blueskyPath = '/xrpc/app.bsky.feed.searchPosts'

const blueskyCase = Effect.gen(function* () {
  const text = yield* body('bluesky-search.json')
  const { out, seen } = yield* serving(blueskyPath, text, bluesky('effect', 2))
  expect(out.length).toBeGreaterThan(0)
  for (const h of out) expect(h.url).toMatch(/^https:\/\/bsky\.app\/profile\/[^/]+\/post\/\w+$/)
  expect(seen.query.get('limit')).toBe('2')
})

const blueskyErrorCase = Effect.gen(function* () {
  const { out } = yield* serving(blueskyPath, 'no', Effect.exit(bluesky('effect', 2)), 400)
  expect(out._tag).toBe('Failure')
})

describe('community adapters', () => {
  test('stackExchange maps questions and sends the contact User-Agent', () =>
    run(stackExchangeCase))
  test('reddit maps posts to permalink hits', () => run(redditCase))
  test('bluesky maps posts to bsky.app post urls', () => run(blueskyCase))
  test('a bluesky server error fails the Effect', () => run(blueskyErrorCase))
})
