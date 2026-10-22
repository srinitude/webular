// A server cannot stall the CLI: a caller's abort signal never switches off the
// per-request timeout.
import { afterAll, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { httpGet } from '../../src/core/http.ts'

// /hang: headers never come. GET only, so no request body is read.
const server = Bun.serve({
  hostname: '127.0.0.1',
  port: 0,
  maxRequestBodySize: 1024,
  fetch: () => new Promise(() => {}),
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
