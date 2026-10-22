// A server cannot stall the CLI: a Retry-After past the 10 s cap fails at once
// with the asked wait, and a caller's abort signal never switches off the
// per-request timeout.
import { afterAll, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { httpGet } from '../../src/core/http.ts'

// /slow-retry asks for 120 s; /hang: headers never come. GET only, so no request body is read.
let hits = 0
const server = Bun.serve({
  hostname: '127.0.0.1',
  port: 0,
  maxRequestBodySize: 1024,
  fetch: (req) => {
    if (new URL(req.url).pathname !== '/slow-retry') return new Promise(() => {})
    hits++
    return new Response('busy', { status: 503, headers: { 'retry-after': '120' } })
  },
})
afterAll(() => server.stop(true))
const base = `http://127.0.0.1:${server.port}`

test(
  'a caller signal and timeoutMs both apply',
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const signal = new AbortController().signal
        const started = Date.now()
        const err = yield* Effect.flip(httpGet(`${base}/hang`, { signal, timeoutMs: 300 }))
        expect(err.aborted).toBe(true)
        expect(Date.now() - started).toBeLessThan(2_000)
      }),
    ),
  5_000,
)

test(
  'a Retry-After over the cap but inside the deadline fails at once, no retry',
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const started = Date.now()
        const err = yield* Effect.flip(httpGet(`${base}/slow-retry`, { timeoutMs: 300_000 }))
        expect(err.message).toContain('asked to wait 120 s (Retry-After), over the 10 s limit')
        expect(hits).toBe(1)
        expect(Date.now() - started).toBeLessThan(2_000)
      }),
    ),
  15_000,
)
