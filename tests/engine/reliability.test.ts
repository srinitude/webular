// Fetch-layer reliability against the local fixture: Retry-After, 408 retry,
// typed status errors, and the Wayback fallback for dead pages. The Wayback
// availability body below is a recorded archive.org response (2026-10-20),
// re-pointed at the fixture origin.
import { describe, expect, test } from 'bun:test'
import type * as BunServices from '@effect/platform-bun/BunServices'
import { Effect } from 'effect'
import { fetchTextOrArchive, rawCapture } from '../../src/core/archive.ts'
import { fetchText, HttpStatusError, retryAfterMs } from '../../src/core/http.ts'
import { type Routes, useFixture } from '../_support/fixture.ts'
import { eff } from '../_support/run.ts'

const TS = '20260102000115'
const html = (body: string) =>
  new Response(`<html><body>${body}</body></html>`, { headers: { 'content-type': 'text/html' } })

function once(first: () => Response, then: () => Response) {
  const seen = { n: 0 }
  return () => (seen.n++ === 0 ? first() : then())
}

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

const routes = (origin: string): Routes => ({
  '/live': () => html('live page'),
  '/dead': () => new Response('gone', { status: 410 }),
  '/missing': () => new Response('nope', { status: 404 }),
  '/binary': () => new Response('PNG', { headers: { 'content-type': 'image/png' } }),
  '/throttled': once(
    () => new Response('slow down', { status: 429, headers: { 'retry-after': '0' } }),
    () => html('after wait'),
  ),
  '/timeout408': once(
    () => new Response('timeout', { status: 408 }),
    () => html('second try'),
  ),
  [`/web/${TS}id_/${origin}/dead`]: () => html('archived copy'),
  '/wayback/available': (_req, url) => availability(origin, url),
})

const fx = useFixture(routes)

const run = <A, E>(body: () => Generator<Effect.Effect<unknown, E, BunServices.BunServices>, A>) =>
  eff(Effect.gen(body))()

describe('retryAfterMs — RFC 9110 delay-seconds or HTTP-date', () => {
  const now = Date.parse('2026-10-20T00:00:00Z')
  test('reads seconds, caps huge values, rejects junk', () => {
    expect(retryAfterMs('2', now)).toBe(2000)
    expect(retryAfterMs('0', now)).toBe(0)
    expect(retryAfterMs('999', now)).toBe(10_000)
    expect(retryAfterMs('-1', now)).toBeUndefined()
    expect(retryAfterMs('soon', now)).toBeUndefined()
    expect(retryAfterMs(null, now)).toBeUndefined()
  })
  test('reads an HTTP-date relative to now; a past date is ignored', () => {
    expect(retryAfterMs('Tue, 20 Oct 2026 00:00:05 GMT', now)).toBe(5000)
    expect(retryAfterMs('Mon, 19 Oct 2026 00:00:00 GMT', now)).toBeUndefined()
  })
})

describe('fetchText — retry and typed errors', () => {
  test('429 with Retry-After retries once, then succeeds', () =>
    run(function* () {
      expect(yield* fetchText(`${fx.origin}/throttled`)).toContain('after wait')
      expect(fx.hits('/throttled')).toBe(2)
    }))
  test('408 is retried', () =>
    run(function* () {
      expect(yield* fetchText(`${fx.origin}/timeout408`)).toContain('second try')
    }))
  test('a 410 fails with HttpStatusError carrying the status', () =>
    run(function* () {
      const err = yield* Effect.flip(fetchText(`${fx.origin}/dead`))
      expect(err).toBeInstanceOf(HttpStatusError)
      expect((err as HttpStatusError).status).toBe(410)
      expect((err as HttpStatusError).message).toMatch(/failed: 410/)
    }))
})

describe('fetchTextOrArchive — Wayback fallback for dead pages', () => {
  const opts = () => ({ archiveOrigin: fx.origin })
  test('a live page never asks the archive', () =>
    run(function* () {
      const before = fx.hits('/wayback/available')
      const r = yield* fetchTextOrArchive(`${fx.origin}/live`, opts())
      expect(r.html).toContain('live page')
      expect(r.archivedFrom).toBeUndefined()
      expect(fx.hits('/wayback/available')).toBe(before)
    }))
  test('a 410 page returns the raw archived capture', () =>
    run(function* () {
      const r = yield* fetchTextOrArchive(`${fx.origin}/dead`, opts())
      expect(r.html).toContain('archived copy')
      expect(r.archivedFrom).toBe(`${fx.origin}/web/${TS}id_/${fx.origin}/dead`)
    }))
  test('no capture keeps the original 404', () =>
    run(function* () {
      const err = yield* Effect.flip(fetchTextOrArchive(`${fx.origin}/missing`, opts()))
      expect((err as HttpStatusError).status).toBe(404)
    }))
  test('a content-type refusal never consults the archive', () =>
    run(function* () {
      const before = fx.hits('/wayback/available')
      const err = yield* Effect.flip(fetchTextOrArchive(`${fx.origin}/binary`, opts()))
      expect(String(err)).toMatch(/unsupported content-type/)
      expect(fx.hits('/wayback/available')).toBe(before)
    }))
})

describe('rawCapture — recorded archive.org capture url', () => {
  test('upgrades web.archive.org to https and asks for the id_ raw capture', () => {
    const recorded = 'http://web.archive.org/web/20260102000115/http://www.example.com/'
    expect(rawCapture(recorded, TS)).toBe(
      'https://web.archive.org/web/20260102000115id_/http://www.example.com/',
    )
  })
})
