// Contract for the map job: the Firecrawl and Tavily map adapters' request
// shape and Output, and the grade a map task gives (every gold page listed).
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { answerAccuracy } from '../../scripts/bench/peers/grade.ts'
import { firecrawlMap, MAP_LIMIT, tavilyMap } from '../../scripts/bench/peers/map-jobs.ts'
import { mapTasks } from '../../scripts/bench/peers/map-tasks.ts'
import type { Provider } from '../../scripts/bench/peers/model.ts'
import type { Post } from '../../scripts/bench/peers/peers.ts'
import { recorded } from './replay.ts'

const runMap = (make: (post: Post, key: string) => Provider['jobs'], reply: unknown) => {
  const { post, seen } = recorded(reply)
  const call = make(post, 'k').map
  return (call ? call({ url: 'https://s.test/' }) : Effect.die('no map')).pipe(
    Effect.map((o) => ({ o, req: seen[0] })),
  )
}

test('firecrawl map posts url and limit with a bearer key and lists link urls', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const reply = { success: true, links: [{ url: 'https://s.test/a', title: 'A' }] }
      const { o, req } = yield* runMap(firecrawlMap, reply)
      expect(req?.url).toBe('https://api.firecrawl.dev/v2/map')
      expect(req?.headers).toEqual({ authorization: 'Bearer k' })
      expect(req?.body).toEqual({ url: 'https://s.test/', limit: MAP_LIMIT })
      expect(o.urls).toEqual(['https://s.test/a'])
      expect(o.text).toBe('https://s.test/a')
    }),
  ))

test('tavily map posts url and limit and bills one credit per ten pages', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const urls = Array.from({ length: 11 }, (_, i) => `https://s.test/${i}`)
      const { o, req } = yield* runMap(tavilyMap, { base_url: 's.test', results: urls })
      expect(req?.url).toBe('https://api.tavily.com/map')
      expect(req?.body).toEqual({ url: 'https://s.test/', limit: MAP_LIMIT })
      expect(o.urls).toEqual(urls)
      expect(o.costUsd).toBeCloseTo(0.016)
    }),
  ))

const listing = (urls: string[]) => ({ text: urls.join('\n'), urls })
const iana = mapTasks.find((t) => t.id === 'map-iana-site')

test('a map task passes only when every gold page is listed', () => {
  expect(iana).toBeDefined()
  if (!iana) return
  const all = ['https://www.iana.org/domains', 'https://www.iana.org/protocols']
  expect(answerAccuracy(iana, listing([...all, 'https://www.iana.org/numbers']))).toBe(1)
  expect(answerAccuracy(iana, listing(all))).toBe(0)
  expect(answerAccuracy(iana, listing(['https://www.iana.org/domains/root/db']))).toBe(0)
})

test('map tasks are three to six, each with gold pages on a public https host', () => {
  expect(mapTasks.length).toBeGreaterThanOrEqual(3)
  expect(mapTasks.length).toBeLessThanOrEqual(6)
  for (const t of mapTasks) {
    expect(t.job).toBe('map')
    expect(t.input.url?.startsWith('https://')).toBe(true)
    expect(t.checks.every((c) => c.kind === 'urlMatches')).toBe(true)
  }
})
