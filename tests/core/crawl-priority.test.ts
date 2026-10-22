// Contract for count-based crawl priority: paths that yielded useful pages
// come first, dead paths last, and pagination/archive shapes and sitemap
// URLs with a fresh lastmod get a boost. No model decides any of it.
import { Database } from 'bun:sqlite'
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { enqueue, makeFrontier, pop, recordVisit, release } from '../../src/lib/crawl-frontier.ts'

const run = <A, E>(e: Effect.Effect<A, E>) => Effect.runSync(e)
const drain = (f: ReturnType<typeof makeFrontier>) => {
  const out: string[] = []
  for (let n = run(pop(f, Number.MAX_SAFE_INTEGER)); n && 'url' in n; ) {
    out.push(n.url)
    release(f, n.host, 0)
    n = run(pop(f, Number.MAX_SAFE_INTEGER))
  }
  return out
}

test('paths that yielded useful pages are crawled before paths that yielded none', () => {
  const f = makeFrontier(new Database(':memory:'), 'yield', 100)
  for (const i of [1, 2]) recordVisit(f, `https://a.test/docs/seen${i}`, true)
  for (const i of [1, 2, 3]) recordVisit(f, `https://a.test/junk/seen${i}`, false)
  run(enqueue(f, ['https://a.test/junk/x', 'https://a.test/other/x', 'https://a.test/docs/x']))
  expect(drain(f)).toEqual([
    'https://a.test/docs/x',
    'https://a.test/other/x',
    'https://a.test/junk/x',
  ])
})

test('a host with useful pages lifts its unseen paths over a dead host', () => {
  const f = makeFrontier(new Database(':memory:'), 'host', 100)
  for (const p of ['a', 'b']) recordVisit(f, `https://good.test/${p}/1`, true)
  for (const p of ['a', 'b', 'c']) recordVisit(f, `https://dead.test/${p}/1`, false)
  run(enqueue(f, ['https://dead.test/z/9', 'https://good.test/z/9']))
  expect(drain(f)[0]).toBe('https://good.test/z/9')
})

test('pagination and archive URL shapes outrank plain pages', () => {
  const f = makeFrontier(new Database(':memory:'), 'shape', 100)
  run(enqueue(f, ['https://a.test/about', 'https://a.test/blog?page=2', 'https://a.test/tag/ai']))
  expect(drain(f).slice(0, 2).sort()).toEqual([
    'https://a.test/blog?page=2',
    'https://a.test/tag/ai',
  ])
})

test('URLs with a fresh sitemap lastmod outrank URLs without one', () => {
  const f = makeFrontier(new Database(':memory:'), 'lastmod', 100)
  const fresh = new Set(['https://a.test/new'])
  run(enqueue(f, ['https://a.test/old', 'https://a.test/new'], undefined, fresh))
  expect(drain(f)).toEqual(['https://a.test/new', 'https://a.test/old'])
})
