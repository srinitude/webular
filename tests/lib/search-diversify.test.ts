import { expect, test } from 'bun:test'
import { scoreHits } from '../../src/lib/search.ts'

const hit = (url: string, title = url, description = url) => ({ title, url, description })
const urls = (r: Array<{ hit: { url: string } }>) => r.map((e) => e.hit.url)

test('near copies on one host (same title) merge into one hit', () => {
  const a = hit('https://news.example.com/a', 'Bun 2 released', 'Bun 2 ships a faster runtime')
  const b = hit('https://news.example.com/print/a', 'Bun 2 Released!', 'Bun 2 ships a runtime')
  const out = scoreHits([[a, hit('https://other.org/x')], [b]], 'x')
  expect(urls(out).filter((u) => new URL(u).hostname === 'news.example.com')).toHaveLength(1)
  expect(out[0]?.hit.url).toBe('https://news.example.com/a')
})

test('hits on different hosts with near-identical snippets merge (syndicated copy)', () => {
  const text = 'the quick brown fox jumps over the lazy dog near the river bank today'
  const list = [hit('https://a.com/1', 'One', text), hit('https://b.com/2', 'Two', text)]
  expect(scoreHits([list], 'x')).toHaveLength(1)
})

test('a list dominated by one host is reordered one hit per host first', () => {
  const list = [
    hit('https://a.com/1', 't1', 'alpha beta'),
    hit('https://a.com/2', 't2', 'gamma delta'),
    hit('https://a.com/3', 't3', 'epsilon zeta'),
    hit('https://b.com/1', 't4', 'eta theta'),
    hit('https://c.com/1', 't5', 'iota kappa'),
  ]
  expect(urls(scoreHits([list], 'x')).slice(0, 3)).toEqual([
    'https://a.com/1',
    'https://b.com/1',
    'https://c.com/1',
  ])
})

test('a non-redundant list keeps its score order', () => {
  const list = ['a', 'b', 'c', 'd', 'e'].map((h) =>
    hit(`https://${h}.com/p`, h, `word${h} other${h}`),
  )
  expect(urls(scoreHits([list], 'x'))).toEqual(list.map((h) => h.url))
})

test('each entry carries its final rank and the lists that returned it', () => {
  const a = hit('https://a.com/p')
  const b = hit('https://b.com/p')
  const out = scoreHits([[a, b], [b]], 'x')
  expect(out.map((e) => e.rank)).toEqual([1, 2])
  expect(out.find((e) => e.hit.url === b.url)?.lists).toEqual([0, 1])
})
