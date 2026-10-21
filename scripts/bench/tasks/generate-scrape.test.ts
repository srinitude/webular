import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { leaksFixtureUrl, startBenchFixture } from '../../../bench/fixtures/server'
import { httpGet } from '../../../src/core/http.ts'
import { eff } from '../../../tests/_support/run.ts'
import { CANARY } from './generate-common'
import { buildBatch, buildPages, generate } from './generate-scrape'

const pages = buildPages()
const text = (b: Uint8Array) => new TextDecoder().decode(b)
const tasks = () => [...pages.map((p) => p.task), ...buildBatch(pages)]

test('150 page tasks, at least 10 per type', () => {
  expect(pages.length).toBe(150)
  const byType = Map.groupBy(pages, (p) => String(p.task.tags['pageType']))
  expect(byType.size).toBe(12)
  for (const g of byType.values()) expect(g.length).toBeGreaterThanOrEqual(10)
  const langs = new Set(
    pages.filter((p) => p.task.tags['pageType'] === 'non-english').map((p) => p.task.tags.language),
  )
  expect(langs.size).toBeGreaterThanOrEqual(5)
})

test('8 or more domains, none over 20%', () => {
  const all = tasks()
  const byDomain = Map.groupBy(all, (t) => t.tags.domain)
  expect(byDomain.size).toBeGreaterThanOrEqual(8)
  for (const g of byDomain.values()) expect(g.length / all.length).toBeLessThanOrEqual(0.2)
})

test('canary in every task and every fixture file', () => {
  for (const p of pages)
    expect([p.task.canary, text(p.bytes).includes(CANARY)]).toEqual([CANARY, true])
})

test('JS fixtures: three levels, gold snippets absent from the raw HTML', () => {
  const js = pages.filter((p) => p.task.tags['noJsFloor'] === true)
  expect(new Set(js.map((p) => p.task.tags['jsLevel']))).toEqual(
    new Set(['light', 'heavy', 'lazy']),
  )
  for (const p of js)
    for (const s of p.task.gold['with'] as string[]) expect(text(p.bytes)).not.toContain(s)
})

test('blocked pages carry a reason; 20 batch jobs of 50 URLs', () => {
  for (const p of pages.filter((x) => x.task.tags['pageType'] === 'blocked'))
    expect(p.task.gold).toMatchObject({ status: 'blocked', reason: expect.any(String) })
  const jobs = buildBatch(pages)
  expect(jobs.length).toBe(20)
  for (const j of jobs) expect((j.input['paths'] as string[]).length).toBe(50)
})

test(
  'server serves a page, 404, 301, and robots.txt',
  eff(
    Effect.gen(function* () {
      yield* generate()
      const fx = yield* startBenchFixture
      const path = pages[0]?.path ?? ''
      const page = yield* httpGet(`${fx.origin}${path}`)
      const body = yield* Effect.promise(() => page.text())
      const missing = yield* httpGet(`${fx.origin}/gone/x.html`)
      const moved = yield* httpGet(`${fx.origin}/r${path}`, { redirect: 'manual' })
      const robots = yield* httpGet(`${fx.origin}/robots.txt`)
      expect(body).toContain(CANARY)
      expect([missing.status, moved.status, moved.headers.get('location')]).toEqual([
        404,
        301,
        path,
      ])
      expect(yield* Effect.promise(() => robots.text())).toContain('Disallow: /pages/blocked/')
      expect(leaksFixtureUrl(`see ${fx.origin}/x`)).toBe(true)
    }),
  ),
  60_000,
)

test('leaksFixtureUrl', () => {
  expect(leaksFixtureUrl('http://localhost:3000/')).toBe(true)
  expect(leaksFixtureUrl('read /pages/article/a.html')).toBe(true)
  expect(leaksFixtureUrl('fixture://pages/x')).toBe(true)
  expect(leaksFixtureUrl('A clean answer about Larkspur Bay.')).toBe(false)
})
