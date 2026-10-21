// Contract for the fetch layer against local Bun.serve fixtures only: 304
// reuses the stored body, the deadline fires as 'timeout', 503 retries then
// succeeds, 404 gives up at once, sockets stay at 1 per host and 16 overall,
// 403 escalates to the render hook, and full-jitter delays stay in [0, cap].
import { expect, test } from 'bun:test'
import { Clock, Effect, type Scope } from 'effect'
import {
  type FetchLayerOptions,
  fullJitterDelay,
  makeFetchLayer,
} from '../../src/lib/fetch-layer.ts'

/** A fixture server owned by the test's Scope; fixtures take GETs only, so bodies stay tiny. */
const serve = (handler: (req: Request) => Response | Promise<Response>) =>
  Effect.map(
    Effect.acquireRelease(
      Effect.sync(() =>
        Bun.serve({ port: 0, hostname: '127.0.0.1', maxRequestBodySize: 1024, fetch: handler }),
      ),
      (s) => Effect.sync(() => s.stop(true)),
    ),
    (s) => s.url.href,
  )

const later = (ms: number, res: () => Response) =>
  Effect.runPromise(Effect.map(Effect.sleep(ms), res))

const check = (body: Effect.Effect<void, unknown, Scope.Scope>) => () =>
  Effect.runPromise(Effect.scoped(body))

const fast: FetchLayerOptions = { retry: { attempts: 3, baseMs: 1, capMs: 5 } }

test(
  'a 304 reuses the stored body',
  check(
    Effect.gen(function* () {
      const url = yield* serve((req) =>
        req.headers.get('if-none-match') === '"v1"'
          ? new Response(null, { status: 304, headers: { etag: '"v1"' } })
          : new Response('hello', { headers: { etag: '"v1"' } }),
      )
      const fetchPage = yield* makeFetchLayer(fast)
      const first = yield* fetchPage(url)
      const second = yield* fetchPage(url)
      expect([first.fromCache, second.fromCache, second.body]).toEqual([false, true, 'hello'])
    }),
  ),
)

test(
  'the deadline fires as a timeout',
  check(
    Effect.gen(function* () {
      const url = yield* serve(() => later(1000, () => new Response('late')))
      const fetchPage = yield* makeFetchLayer(fast)
      const error = yield* Effect.flip(fetchPage(url, { deadlineMs: 50 }))
      expect(error.kind).toBe('timeout')
    }),
  ),
)

test(
  'a 503 retries, then succeeds',
  check(
    Effect.gen(function* () {
      let hits = 0
      const url = yield* serve(() =>
        ++hits === 1 ? new Response('busy', { status: 503 }) : new Response('ok'),
      )
      const fetchPage = yield* makeFetchLayer(fast)
      const result = yield* fetchPage(url)
      expect([result.body, hits]).toEqual(['ok', 2])
    }),
  ),
)

test(
  'a 404 gives up with no retry',
  check(
    Effect.gen(function* () {
      let hits = 0
      const url = yield* serve(() => {
        hits++
        return new Response('missing', { status: 404 })
      })
      const fetchPage = yield* makeFetchLayer(fast)
      const error = yield* Effect.flip(fetchPage(url))
      expect([error.kind, error.next_action, hits]).toEqual(['http', 'give-up', 1])
    }),
  ),
)

test(
  'sockets stay at one per host and sixteen overall',
  check(
    Effect.gen(function* () {
      let global = 0
      let maxGlobal = 0
      let maxPerHost = 0
      const host = () => {
        let inHost = 0
        return serve(() => {
          maxPerHost = Math.max(maxPerHost, ++inHost)
          maxGlobal = Math.max(maxGlobal, ++global)
          return later(20, () => {
            inHost--
            global--
            return new Response('x')
          })
        })
      }
      const urls = yield* Effect.forEach(Array.from({ length: 24 }), host, { concurrency: 1 })
      const all = [...urls, ...urls, ...urls]
      const fetchPage = yield* makeFetchLayer(fast)
      yield* Effect.forEach(all, (u) => fetchPage(u), { concurrency: all.length, discard: true })
      expect(maxPerHost).toBe(1)
      expect(maxGlobal).toBeLessThanOrEqual(16)
      expect(maxGlobal).toBeGreaterThan(1)
    }),
  ),
)

test(
  'a 403 escalates to the render hook',
  check(
    Effect.gen(function* () {
      const url = yield* serve(() => new Response('nope', { status: 403 }))
      const seen: string[] = []
      const browser = {
        name: 'browser',
        render: (u: string) =>
          Effect.sync(() => {
            seen.push(u)
            return { status: 200, body: 'rendered' }
          }),
      }
      const fetchPage = yield* makeFetchLayer({ ...fast, tiers: [browser] })
      const result = yield* fetchPage(url)
      expect([result.tier, result.body, seen]).toEqual(['browser', 'rendered', [url]])
    }),
  ),
)

/** mulberry32: a seeded RNG so a failing case replays. */
const seeded = (start: number) => {
  let seed = start
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

test('full-jitter delays stay in [0, cap]', () => {
  const rng = seeded(42)
  for (let i = 0; i < 10_000; i++) {
    const attempt = Math.floor(rng() * 64)
    const base = 1 + rng() * 1000
    const cap = 1 + rng() * 60_000
    const delay = fullJitterDelay(attempt, base, cap, rng())
    expect(delay >= 0 && delay <= cap).toBe(true)
  }
})

test(
  'a retry backoff gives its permits back while it sleeps',
  check(
    Effect.gen(function* () {
      let calls = 0
      const slow = yield* serve(() =>
        ++calls === 1
          ? new Response('busy', { status: 503, headers: { 'retry-after': '1' } })
          : new Response('ok'),
      )
      const quick = yield* serve(() => new Response('ok'))
      const fetchPage = yield* makeFetchLayer({
        globalSockets: 1,
        retry: { attempts: 2, baseMs: 1, capMs: 2000 },
      })
      const started = yield* Clock.currentTimeMillis
      let quickMs = 0
      yield* Effect.all(
        [
          fetchPage(slow),
          Effect.andThen(Effect.sleep(100), fetchPage(quick)).pipe(
            Effect.tap(() => Effect.map(Clock.currentTimeMillis, (t) => (quickMs = t - started))),
          ),
        ],
        { concurrency: 2 },
      )
      // Holding the one global permit through the 1 s backoff would push this past 1000 ms.
      expect(quickMs).toBeLessThan(800)
      expect(calls).toBe(2)
    }),
  ),
)
