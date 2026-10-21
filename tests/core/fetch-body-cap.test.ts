// A chunked body (no Content-Length) over the cap fails as 'too-large' before the whole body is read.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { makeFetchLayer } from '../../src/lib/fetch-layer.ts'

const CHUNK = new Uint8Array(1024).fill(97)
const CHUNKS = 20_000
const CAP = 10 * 1024

/** Serves CHUNKS 1 KiB chunks on demand and counts how many were pulled. */
const serveChunked = (counter: { pulled: number }) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const body = () =>
        new ReadableStream<Uint8Array>({
          pull(ctl) {
            if (++counter.pulled > CHUNKS) return ctl.close()
            ctl.enqueue(CHUNK)
          },
        })
      return Bun.serve({
        port: 0,
        hostname: '127.0.0.1',
        maxRequestBodySize: 1024,
        fetch: () => new Response(body()),
      })
    }),
    (s) => Effect.sync(() => s.stop(true)),
  )

const program = Effect.gen(function* () {
  const counter = { pulled: 0 }
  const server = yield* serveChunked(counter)
  const fetchPage = yield* makeFetchLayer({ maxBytes: CAP, retry: { attempts: 1 } })
  const error = yield* Effect.flip(fetchPage(server.url.href))
  expect(error.kind).toBe('too-large')
  expect(counter.pulled).toBeLessThan(CHUNKS / 4)
})

test('a chunked body over the cap fails early', () => Effect.runPromise(Effect.scoped(program)))
