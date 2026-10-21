// Factoid lookups rank stable reference hits above forum threads. Recorded live
// Wikipedia and Hacker News lists for the query (no network): the HN thread
// names Madrid only in its title, yet a plain RRF fusion put it first.
import { expect, test } from 'bun:test'
import { isFactoid, rankHits } from '../../src/lib/search.ts'
import { hostRole } from '../../src/lib/sources/roles.ts'
import spain from '../fixtures/sources/capital-of-spain-lists.json'

const fused = rankHits([spain.lists.wikipedia, spain.lists.hackernews], spain.query)
const at = (url: string) => fused.findIndex((h) => h.url === url)

test('the top hit of a factoid lookup comes from a stable source', () => {
  expect(hostRole(fused[0]?.url ?? '')).toBe('stable')
})

test('the Madrid page outranks the Hacker News thread', () => {
  expect(at('https://en.wikipedia.org/wiki/Madrid')).toBeLessThan(
    at('https://news.ycombinator.com/item?id=14386607'),
  )
})

test('forum threads still lead a query that is not a factoid', () => {
  const lists = [spain.lists.hackernews, spain.lists.wikipedia]
  expect(hostRole(rankHits(lists, 'madrid barcelona tech scene')[0]?.url ?? '')).toBe('validation')
})

test('the factoid rule needs a wh-word lead', () => {
  expect(isFactoid(spain.query)).toBe(true)
  expect(isFactoid('Who wrote One Hundred Years of Solitude?')).toBe(true)
  expect(isFactoid('madrid barcelona tech scene')).toBe(false)
  expect(isFactoid('how to deploy bun on fly')).toBe(false)
})
