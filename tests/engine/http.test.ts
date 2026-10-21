// HTTP-layer contract against the local fixture: redirect scoping, charset
// handling, the textual content-type guard, and deterministic bounded retry.
import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { fetchText, fetchTextWithinHost } from '../../src/core/http.ts'
import { startFixture, useFixture } from '../_support/fixture.ts'
import { defaultRoutes } from '../_support/routes.ts'
import { eff, failMsg } from '../_support/run.ts'

const fx = useFixture(defaultRoutes)

describe('fetchTextWithinHost — exact-host redirect scoping', () => {
  test(
    'follows a same-host redirect',
    eff(
      Effect.gen(function* () {
        const text = yield* fetchTextWithinHost(`${fx.origin}/redirect`, '127.0.0.1')
        expect(text).toContain('Alpha')
      }),
    ),
  )

  test(
    'blocks an off-host redirect',
    eff(
      Effect.gen(function* () {
        expect(yield* failMsg(fetchTextWithinHost(`${fx.origin}/offsite`, '127.0.0.1'))).toMatch(
          /off-site/,
        )
      }),
    ),
  )
})

describe('fetchText — charset handling (B3)', () => {
  test(
    'decodes windows-1252 declared in the header',
    eff(
      Effect.gen(function* () {
        const text = yield* fetchText(`${fx.origin}/charset/header-1252`)
        expect(text).toContain('café')
      }),
    ),
  )

  test(
    'decodes windows-1252 declared only in <meta charset>',
    eff(
      Effect.gen(function* () {
        const text = yield* fetchText(`${fx.origin}/charset/meta-1252`)
        expect(text).toContain('café')
      }),
    ),
  )

  test(
    'decodes a UTF-16LE body via its BOM',
    eff(
      Effect.gen(function* () {
        const text = yield* fetchText(`${fx.origin}/charset/bom16le`)
        expect(text).toContain('hello bom')
      }),
    ),
  )
})

describe('fetchText — content-type guard (B4)', () => {
  test(
    'rejects binary bodies instead of emitting garbage',
    eff(
      Effect.gen(function* () {
        expect(yield* failMsg(fetchText(`${fx.origin}/binary`))).toMatch(/unsupported content-type/)
      }),
    ),
  )

  test(
    'accepts XML (sitemaps)',
    eff(
      Effect.gen(function* () {
        const xml = yield* fetchText(`${fx.origin}/sitemap.xml`)
        expect(xml).toContain('<urlset>')
      }),
    ),
  )
})

describe('httpGet retry — deterministic and bounded', () => {
  test(
    'retries through transient 503s and succeeds on the 3rd hit',
    eff(
      Effect.gen(function* () {
        const local = yield* startFixture(defaultRoutes)
        const text = yield* fetchText(`${local.origin}/flaky?key=retry-ok&fails=2`)
        expect(text).toBe('flaky ok')
        expect(local.hits('/flaky')).toBe(3)
      }),
    ),
    15_000,
  )

  test(
    'does not retry a plain 404',
    eff(
      Effect.gen(function* () {
        const local = yield* startFixture(defaultRoutes)
        expect(yield* failMsg(fetchText(`${local.origin}/status?code=404`))).toMatch(/404/)
        yield* Effect.sleep(50)
        expect(local.hits('/status')).toBe(1)
      }),
    ),
  )

  test(
    'gives up after 3 attempts on a persistent 503',
    eff(
      Effect.gen(function* () {
        const local = yield* startFixture(defaultRoutes)
        expect(yield* failMsg(fetchText(`${local.origin}/status?code=503`))).toMatch(/503/)
        yield* Effect.sleep(1400)
        expect(local.hits('/status')).toBe(3)
      }),
    ),
    15_000,
  )

  test(
    'does not retry a timeout abort (the --timeout budget)',
    eff(
      Effect.gen(function* () {
        const local = yield* startFixture(defaultRoutes)
        expect(yield* failMsg(fetchText(`${local.origin}/stall`, { timeoutMs: 300 }))).toMatch(/./)
        yield* Effect.sleep(1400)
        expect(local.hits('/stall')).toBe(1)
      }),
    ),
    15_000,
  )
})

// A rejected body left unread pins its pooled connection until GC. Measured on
// these four paths: 0 server-side cancels without the cancel, 4 with it.
function cancelTrackingRoutes(cancels: { n: number }) {
  const tracked = () =>
    new ReadableStream<Uint8Array>({
      start: (c) => c.enqueue(new TextEncoder().encode('x'.repeat(1024))),
      cancel: () => {
        cancels.n++
      },
    })
  return () => ({
    '/gone': () => new Response(tracked(), { status: 410 }),
    '/png': () => new Response(tracked(), { headers: { 'content-type': 'image/png' } }),
    '/hop': () => new Response(tracked(), { status: 302, headers: { location: '/end' } }),
    '/away': () =>
      new Response(tracked(), { status: 302, headers: { location: 'http://offsite.invalid/x' } }),
    '/end': () => new Response('end page', { headers: { 'content-type': 'text/plain' } }),
  })
}

describe('rejected responses free their bodies', () => {
  test(
    'non-ok, non-text, followed and blocked redirect hops each cancel the body',
    eff(
      Effect.gen(function* () {
        const cancels = { n: 0 }
        const local = yield* startFixture(cancelTrackingRoutes(cancels))
        expect(yield* failMsg(fetchText(`${local.origin}/gone`))).toMatch(/410/)
        expect(yield* failMsg(fetchText(`${local.origin}/png`))).toMatch(/unsupported content-type/)
        expect(yield* fetchTextWithinHost(`${local.origin}/hop`, '127.0.0.1')).toBe('end page')
        expect(yield* failMsg(fetchTextWithinHost(`${local.origin}/away`, '127.0.0.1'))).toMatch(
          /off-site/,
        )
        yield* Effect.sleep(300)
        expect(cancels.n).toBe(4)
      }),
    ),
    15_000,
  )
})
