// FEED fallback chain against real local fixtures (no mocks): direct feed,
// <link rel="alternate"> discovery, same-origin guesses, then Wayback, then the
// free feed search. The availability body is the recorded archive.org shape
// from reliability.test.ts, re-pointed at the fixture origin.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type * as BunServices from '@effect/platform-bun/BunServices'
import { Effect } from 'effect'
import { resolveFeed } from '../../src/core/feed-source.ts'
import { type Routes, useFixture } from '../_support/fixture.ts'
import { eff } from '../_support/run.ts'

const TS = '20260102000115'
const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>T</title></channel></rss>`
const res = (body: string, type: string) => () =>
  new Response(body, { headers: { 'content-type': type } })
const page = (head: string) => res(`<html><head>${head}</head><body>hi</body></html>`, 'text/html')

const site = useFixture(() => ({
  '/direct.xml': res(RSS, 'application/rss+xml'),
  '/alt.xml': res(RSS, 'application/rss+xml'),
  '/linked': page('<link rel="alternate" type="application/rss+xml" href="/alt.xml">'),
  '/plain': page('<title>no feed link</title>'),
  '/feed': res(RSS, 'application/rss+xml'),
}))

function availability(origin: string, url: URL): Response {
  const target = url.searchParams.get('url') ?? ''
  const closest = {
    status: '200',
    available: true,
    url: `${origin}/web/${TS}/${target}`,
    timestamp: TS,
  }
  const snapshots = target.endsWith('/dead') ? { closest } : {}
  return Response.json({ url: target, archived_snapshots: snapshots, timestamp: '20260101' })
}

// A bare origin: no feed paths, so only the archive can answer.
const bare = useFixture(
  (origin): Routes => ({
    '/plain': page(''),
    '/wayback/available': (_req, url) => availability(origin, url),
    [`/web/${TS}id_/${origin}/dead`]: res(RSS, 'application/rss+xml'),
  }),
)

// feedsearch.dev stand-in: it knows one site, whose feed lives on this origin.
const free = useFixture(
  (origin): Routes => ({
    '/api/v1/search': (_req, url) =>
      Response.json(
        url.searchParams.get('url')?.endsWith('/nothing') ? [{ url: `${origin}/found.xml` }] : [],
      ),
    '/found.xml': res(RSS, 'application/rss+xml'),
  }),
)
const saved = {
  origin: process.env['WEBULAR_SOURCE_ORIGIN'],
  gap: process.env['WEBULAR_SOURCE_GAP_MS'],
}
beforeAll(() => {
  process.env['WEBULAR_SOURCE_ORIGIN'] = free.origin
  process.env['WEBULAR_SOURCE_GAP_MS'] = '0'
})
afterAll(() => {
  if (saved.origin === undefined) delete process.env['WEBULAR_SOURCE_ORIGIN']
  else process.env['WEBULAR_SOURCE_ORIGIN'] = saved.origin
  if (saved.gap === undefined) delete process.env['WEBULAR_SOURCE_GAP_MS']
  else process.env['WEBULAR_SOURCE_GAP_MS'] = saved.gap
})

const run = <A, E>(body: () => Generator<Effect.Effect<unknown, E, BunServices.BunServices>, A>) =>
  eff(Effect.gen(body))()
const resolve = (url: string) => resolveFeed(url, { archive: true, archiveOrigin: bare.origin })

describe('resolveFeed — feed fallback chain', () => {
  test('a direct feed is used as given', () =>
    run(function* () {
      const r = yield* resolve(`${site.origin}/direct.xml`)
      expect(r.feedUrl).toBe(`${site.origin}/direct.xml`)
      expect(r.archivedFrom).toBeUndefined()
    }))
  test('an HTML page falls back to its rel=alternate feed', () =>
    run(function* () {
      expect((yield* resolve(`${site.origin}/linked`)).feedUrl).toBe(`${site.origin}/alt.xml`)
    }))
  test('an HTML page with no link falls back to a same-origin /feed guess', () =>
    run(function* () {
      expect((yield* resolve(`${site.origin}/plain`)).feedUrl).toBe(`${site.origin}/feed`)
    }))
  test('a dead url with no guesses falls back to the Wayback capture', () =>
    run(function* () {
      const r = yield* resolve(`${bare.origin}/dead`)
      expect(r.xml).toContain('<rss')
      expect(r.archivedFrom).toBe(`${bare.origin}/web/${TS}id_/${bare.origin}/dead`)
    }))
  test('a dead url with no capture keeps its typed 404', () =>
    run(function* () {
      const err = yield* Effect.flip(resolve(`${bare.origin}/missing`))
      expect(err).toMatchObject({ _tag: 'HttpStatusError', status: 404 })
    }))
  test('a live page with no feed anywhere fails with NotAFeed, archive untouched', () =>
    run(function* () {
      const before = bare.hits('/wayback/available')
      const err = yield* Effect.flip(resolve(`${bare.origin}/plain`))
      expect(err).toMatchObject({ _tag: 'NotAFeed', url: `${bare.origin}/plain` })
      expect(bare.hits('/wayback/available')).toBe(before)
    }))
  test('a chain that fails everywhere falls back to the free feed search', () =>
    run(function* () {
      const r = yield* resolve(`${free.origin}/nothing`)
      expect(r.feedUrl).toBe(`${free.origin}/found.xml`)
      expect(r.xml).toContain('<rss')
    }))
})
