// The site-autodiscovery feed adapter against a recorded home page served by a
// real local fixture, and the fallback from feedsearch.dev to it. No mocks.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { siteFeeds } from '../../../src/lib/sources/feeds.ts'
import { feedSearch } from '../../../src/lib/sources/web.ts'
import { against, body, run } from './support.ts'

const html = (text: string) => new Response(text, { headers: { 'content-type': 'text/html' } })

const listCase = Effect.gen(function* () {
  const page = yield* body('site-home.html')
  const hits = yield* against({ '/': () => html(page) }, siteFeeds('xkcd.com', 5))
  expect(hits.map((h) => [h.title, h.url])).toEqual([
    ['Atom 1.0', 'https://xkcd.com/atom.xml'],
    ['RSS 2.0', 'https://xkcd.com/rss.xml'],
  ])
})

const limitCase = Effect.gen(function* () {
  const page = yield* body('site-home.html')
  const hits = yield* against({ '/': () => html(page) }, siteFeeds('https://xkcd.com', 1))
  expect(hits.map((h) => h.url)).toEqual(['https://xkcd.com/atom.xml'])
})

const noneCase = Effect.gen(function* () {
  const hits = yield* against(
    { '/': () => html('<html><head></head></html>') },
    siteFeeds('a.io', 3),
  )
  expect(hits).toEqual([])
})

// feedsearch.dev has no route (404), so the chain falls through to the site.
const fallbackCase = Effect.gen(function* () {
  const page = yield* body('site-home.html')
  const chained = feedSearch('xkcd.com', 5).pipe(Effect.catch(() => siteFeeds('xkcd.com', 5)))
  const hits = yield* against({ '/': () => html(page) }, chained)
  expect(hits.map((h) => h.url)).toEqual(['https://xkcd.com/atom.xml', 'https://xkcd.com/rss.xml'])
})

describe('site feed autodiscovery', () => {
  test('siteFeeds reads alternate feed links and resolves hrefs', () => run(listCase), 15_000)
  test('siteFeeds cuts to the limit', () => run(limitCase), 15_000)
  test('siteFeeds returns nothing for a page without feed links', () => run(noneCase), 15_000)
  test('siteFeeds answers when feedsearch fails', () => run(fallbackCase), 15_000)
})
