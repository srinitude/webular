// Fault injection on a real local Bun.serve fixture, for both fetch paths
// (src/core/http.ts fetchText and src/lib/fetch-layer.ts makeFetchLayer):
// a slow response hits the bounded timeout, a 429 waits its Retry-After, a
// 5xx retries, and a connection dropped mid-body is a network error.
import { expect, test } from 'bun:test'
import { Clock, Effect } from 'effect'
import { fetchText } from '../../src/core/http.ts'
import { type FetchLayerOptions, makeFetchLayer } from '../../src/lib/fetch-layer.ts'
import { eff, failMsg } from '../_support/run.ts'

type Reply = 'ok' | 'slow' | '429' | '500' | '503' | 'drop'

const text = (body: string, status = 200, headers: Record<string, string> = {}) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain', ...headers } })

// Headers go out, then the body stream errors: the socket closes mid-response.
const dropped = () =>
  new Response(
    new ReadableStream({
      start: (c) => {
        c.enqueue(new TextEncoder().encode('par'))
        c.error(new Error('dropped'))
      },
    }),
    { headers: { 'content-type': 'text/plain', 'content-length': '100' } },
  )

const answer = (reply: Reply): Response | Promise<Response> => {
  if (reply === 'slow') return Effect.runPromise(Effect.as(Effect.sleep(2000), text('late')))
  if (reply === '429') return text('busy', 429, { 'retry-after': '1' })
  if (reply === 'drop') return dropped()
  return reply === 'ok' ? text('ok') : text('fail', Number(reply))
}

// Answers hit n with replies[n], then 'ok'; the server stops with the test scope.
// The fixture takes GETs only, so request bodies stay tiny.
const serve = (replies: Reply[]) =>
  Effect.map(
    Effect.acquireRelease(
      Effect.sync(() => {
        const hits = { n: 0 }
        const server = Bun.serve({
          port: 0,
          hostname: '127.0.0.1',
          maxRequestBodySize: 1024,
          fetch: () => answer(replies[hits.n++] ?? 'ok'),
        })
        return { server, hits }
      }),
      ({ server }) => Effect.sync(() => server.stop(true)),
    ),
    ({ server, hits }) => ({ url: `${server.url.href}page`, hits }),
  )

const timed = <A, E>(body: Effect.Effect<A, E>) =>
  Effect.gen(function* () {
    const start = yield* Clock.currentTimeMillis
    const value = yield* body
    return { value, ms: (yield* Clock.currentTimeMillis) - start }
  })

const off = { cache: false }
const layer: FetchLayerOptions = { retry: { attempts: 3, baseMs: 1, capMs: 2000 } }

test(
  'core: a slow response stops at the timeout and is not retried',
  eff(
    Effect.gen(function* () {
      const fx = yield* serve(['slow'])
      const { value, ms } = yield* timed(failMsg(fetchText(fx.url, { ...off, timeoutMs: 200 })))
      expect(value).toMatch(/time/i)
      expect([ms < 1500, fx.hits.n]).toEqual([true, 1])
    }),
  ),
)

test(
  'core: a 429 waits its Retry-After, then succeeds',
  eff(
    Effect.gen(function* () {
      const fx = yield* serve(['429'])
      const { value, ms } = yield* timed(fetchText(fx.url, off))
      expect([value, fx.hits.n, ms >= 900]).toEqual(['ok', 2, true])
    }),
  ),
)

// RETRY_STATUS in src/core/fetch-policy.ts retries 502, 503, and 504 only.
test(
  'core: a 503 retries; a 500 fails at once with its status',
  eff(
    Effect.gen(function* () {
      const flaky = yield* serve(['503'])
      expect(yield* fetchText(flaky.url, off)).toBe('ok')
      expect(flaky.hits.n).toBe(2)
      const broken = yield* serve(['500', '500', '500'])
      expect(yield* failMsg(fetchText(broken.url, off))).toMatch(/500/)
      expect(broken.hits.n).toBe(1)
    }),
  ),
)

test(
  'core: a dropped connection retries as a network error',
  eff(
    Effect.gen(function* () {
      const fx = yield* serve(['drop'])
      expect([yield* fetchText(fx.url, off), fx.hits.n]).toEqual(['ok', 2])
    }),
  ),
)

test(
  'layer: a slow response fires the deadline as a timeout',
  eff(
    Effect.gen(function* () {
      const fx = yield* serve(['slow'])
      const fetchPage = yield* makeFetchLayer(layer)
      const { value, ms } = yield* timed(Effect.flip(fetchPage(fx.url, { deadlineMs: 200 })))
      expect([value.kind, ms < 1500]).toEqual(['timeout', true])
    }),
  ),
)

test(
  'layer: a 429 waits its Retry-After, then succeeds',
  eff(
    Effect.gen(function* () {
      const fx = yield* serve(['429'])
      const fetchPage = yield* makeFetchLayer(layer)
      const { value, ms } = yield* timed(fetchPage(fx.url, { deadlineMs: 5000 }))
      expect([value.body, fx.hits.n, ms >= 900]).toEqual(['ok', 2, true])
    }),
  ),
)

test(
  'layer: 5xx retries up to its budget, then fails with the status',
  eff(
    Effect.gen(function* () {
      const fetchPage = yield* makeFetchLayer(layer)
      const flaky = yield* serve(['500', '503'])
      expect((yield* fetchPage(flaky.url)).body).toBe('ok')
      const broken = yield* serve(['500', '500', '500'])
      const error = yield* Effect.flip(fetchPage(broken.url))
      expect([error.status, broken.hits.n]).toEqual([500, 3])
    }),
  ),
)

test(
  'layer: a connection dropped mid-body retries as a network error',
  eff(
    Effect.gen(function* () {
      const fx = yield* serve(['drop'])
      const fetchPage = yield* makeFetchLayer(layer)
      expect([(yield* fetchPage(fx.url)).body, fx.hits.n]).toEqual(['ok', 2])
    }),
  ),
)
