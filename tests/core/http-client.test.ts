// The HttpClient transport sends only webular's own headers (no trace headers),
// keeps the status text, and a timeout still cuts a body that stalls mid-read.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { fetchText, httpGet } from '../../src/core/http.ts'
import { useFixture } from '../_support/fixture.ts'
import { eff, failMsg } from '../_support/run.ts'

const plain = (body: string) => new Response(body, { headers: { 'content-type': 'text/plain' } })

const stalled = () =>
  new Response(
    new ReadableStream({ start: (c) => c.enqueue(new TextEncoder().encode('partial')) }),
    { headers: { 'content-type': 'text/plain' } },
  )

const fx = useFixture(() => ({
  '/echo': (req) =>
    plain(['user-agent', 'traceparent', 'b3'].map((h) => req.headers.get(h) ?? '-').join('|')),
  '/teapot': () => new Response('no', { status: 418 }),
  '/stall': stalled,
}))

test(
  'sends user-agent and no trace headers',
  eff(
    Effect.gen(function* () {
      const sent = yield* fetchText(`${fx.origin}/echo`, { cache: false })
      expect(sent).toMatch(/^webular\/\S+ .*\|-\|-$/)
    }),
  ),
)

test(
  'keeps status and status text',
  eff(
    Effect.gen(function* () {
      const res = yield* httpGet(`${fx.origin}/teapot`)
      expect(res.status).toBe(418)
      expect(res.statusText).not.toBe('')
      expect(yield* failMsg(fetchText(`${fx.origin}/teapot`))).toMatch(/418/)
    }),
  ),
)

test(
  'a timeout aborts a body that stalls after headers',
  eff(
    Effect.gen(function* () {
      expect(yield* failMsg(fetchText(`${fx.origin}/stall`, { timeoutMs: 200 }))).toBeTruthy()
    }),
  ),
)
