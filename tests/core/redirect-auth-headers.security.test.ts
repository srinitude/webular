// Auth headers (API-Key, Authorization, Cookie, x-api-key) follow a redirect
// only on the same host; a cross-host hop drops them.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { httpGet } from '../../src/core/http.ts'
import { startFixture } from '../_support/fixture.ts'
import { eff } from '../_support/run.ts'

const SECRET = {
  'API-Key': 's3cret',
  Authorization: 'Bearer s3cret',
  Cookie: 'a=s3cret',
  'x-api-key': 's3cret',
}

const seenAt = Effect.fn('seenAt')(function* (hostOnTarget: string) {
  let seen: Headers | undefined
  const fx = yield* startFixture(() => ({
    '/start': (_req, url) =>
      new Response(null, {
        status: 302,
        headers: { location: `http://${hostOnTarget}:${url.port}/end` },
      }),
    '/end': (req) => {
      seen = req.headers
      return new Response('ok')
    },
  }))
  const res = yield* httpGet(`${fx.origin}/start`, { headers: SECRET })
  expect(yield* Effect.promise(() => res.text())).toBe('ok')
  return seen as Headers
})

test(
  'a cross-host redirect drops every auth header',
  eff(
    Effect.gen(function* () {
      const h = yield* seenAt('localhost')
      for (const name of Object.keys(SECRET)) expect(h.get(name)).toBeNull()
    }),
  ),
)

test(
  'a same-host redirect keeps them',
  eff(
    Effect.gen(function* () {
      const h = yield* seenAt('127.0.0.1')
      expect(h.get('api-key')).toBe('s3cret')
    }),
  ),
)

test(
  "redirect 'manual' returns the 302 with no hop, so no gate or credential reaches the target",
  eff(
    Effect.gen(function* () {
      let hops = 0
      const fx = yield* startFixture(() => ({
        '/start': () => new Response(null, { status: 302, headers: { location: '/end' } }),
        '/end': () => new Response(String(++hops)),
      }))
      const hopGate = () => Effect.sync(() => void ++hops)
      const res = yield* httpGet(`${fx.origin}/start`, {
        headers: SECRET,
        redirect: 'manual',
        hopGate,
      })
      expect([res.status, res.headers.get('location'), hops]).toEqual([302, '/end', 0])
    }),
  ),
)
