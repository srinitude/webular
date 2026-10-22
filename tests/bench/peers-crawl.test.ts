// Contract for the crawl job: the Firecrawl and Tavily adapters' request shape and
// Output, the grade a crawl task gives (every gold page plus its gold text), and
// webular's own crawl arm against the local fixture site.
import { expect, test } from 'bun:test'
import { Effect, Schema } from 'effect'
import {
  CRAWL_DEPTH,
  CRAWL_LIMIT,
  firecrawlCrawl,
  tavilyCrawl,
} from '../../scripts/bench/peers/crawl-jobs.ts'
import { crawlRoutes, crawlTasks } from '../../scripts/bench/peers/crawl-tasks.ts'
import { answerAccuracy } from '../../scripts/bench/peers/grade.ts'
import { webular } from '../../scripts/bench/peers/providers.ts'
import type { Get } from '../../scripts/bench/peers/research-jobs.ts'
import { useFixture } from '../_support/fixture.ts'
import { recorded } from './replay.ts'

const fixtureTask = crawlTasks.find((t) => t.id === 'crawl-fixture-harbor')
const page = (path: string, text: string) => ({ url: `https://s.test/crawl/${path}`, text })
const goldPages = [
  page('tides', 'peaks at 4.2 metres'),
  page('ships', 'registry number 7731'),
  page('lighthouse', 'flashes every eleven seconds'),
]
const listing = (pages: { url: string; text: string }[]) => ({
  text: pages.map((p) => `## ${p.url}\n\n${p.text}`).join('\n\n'),
  urls: pages.map((p) => p.url),
})

test('firecrawl crawl starts a crawl, polls its id, and joins each page markdown', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { post, seen } = recorded({ success: true, id: 'abc' })
      const polled: string[] = []
      const get: Get = (url, headers, schema) => {
        polled.push(url)
        const status = polled.length === 1 ? 'scraping' : 'completed'
        const data = [{ markdown: 'hello', metadata: { sourceURL: 'https://s.test/a' } }]
        expect(headers).toEqual({ authorization: 'Bearer k' })
        return Schema.decodeUnknownEffect(schema)({ status, data }).pipe(Effect.orDie)
      }
      const call = firecrawlCrawl(post, get, 'k').crawl
      const o = yield* call ? call({ url: 'https://s.test/' }) : Effect.die('no crawl')
      expect(seen[0]?.url).toBe('https://api.firecrawl.dev/v2/crawl')
      expect(seen[0]?.body).toEqual({
        url: 'https://s.test/',
        limit: CRAWL_LIMIT,
        maxDiscoveryDepth: CRAWL_DEPTH,
        scrapeOptions: { formats: ['markdown'] },
      })
      expect(polled).toEqual(Array(2).fill('https://api.firecrawl.dev/v2/crawl/abc'))
      expect(o.urls).toEqual(['https://s.test/a'])
      expect(o.text).toBe('## https://s.test/a\n\nhello')
      expect(o.costUsd).toBeCloseTo(83 / 100_000)
    }),
  ))

test('firecrawl crawl fails when the crawl does not complete', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { post } = recorded({ id: 'abc' })
      const get: Get = (_u, _h, schema) =>
        Schema.decodeUnknownEffect(schema)({ status: 'failed' }).pipe(Effect.orDie)
      const call = firecrawlCrawl(post, get, 'k').crawl
      const result = yield* (call ? call({ url: 'https://s.test/' }) : Effect.die('no crawl')).pipe(
        Effect.result,
      )
      expect(result._tag).toBe('Failure')
    }),
  ))

test('tavily crawl posts url, limit, and depth and bills mapping plus extraction credits', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const results = Array.from({ length: 10 }, (_, i) => ({
        url: `https://s.test/${i}`,
        raw_content: `page ${i}`,
      }))
      const { post, seen } = recorded({ base_url: 's.test', results })
      const call = tavilyCrawl(post, 'k').crawl
      const o = yield* call ? call({ url: 'https://s.test/' }) : Effect.die('no crawl')
      expect(seen[0]?.url).toBe('https://api.tavily.com/crawl')
      expect(seen[0]?.headers).toEqual({ authorization: 'Bearer k' })
      expect(seen[0]?.body).toMatchObject({
        url: 'https://s.test/',
        limit: CRAWL_LIMIT,
        max_depth: CRAWL_DEPTH,
      })
      expect(o.urls).toHaveLength(10)
      expect(o.costUsd).toBeCloseTo(3 * 0.008)
    }),
  ))

test('a crawl task passes only when every gold page and its gold text are present', () => {
  expect(fixtureTask).toBeDefined()
  if (!fixtureTask) return
  expect(answerAccuracy(fixtureTask, listing(goldPages))).toBe(1)
  expect(answerAccuracy(fixtureTask, listing(goldPages.slice(0, 2)))).toBe(0)
  const noText = goldPages.map((p) => ({ ...p, text: '' }))
  expect(answerAccuracy(fixtureTask, listing(noText))).toBe(0)
})

test('crawl tasks are crawl jobs; the fixture one is local only', () => {
  expect(crawlTasks.every((t) => t.job === 'crawl')).toBe(true)
  expect(fixtureTask?.localOnly).toBe(true)
  expect(fixtureTask?.input.url).toBe('{fixture}/crawl')
})

const fx = useFixture(() => crawlRoutes)

test(
  'webular crawl reaches the depth-2 page and reads its text',
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const call = webular.jobs.crawl
        const o = yield* call ? call({ url: `${fx.origin}/crawl` }) : Effect.die('no crawl')
        expect(fixtureTask).toBeDefined()
        if (fixtureTask) expect(answerAccuracy(fixtureTask, o)).toBe(1)
      }),
    ),
  60_000,
)
