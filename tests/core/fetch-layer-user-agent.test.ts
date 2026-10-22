// Contract: every request the fetch layer sends carries webular's user-agent,
// so a site's robots.txt group for `webular` matches what it actually sees.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { makeFetchLayer } from '../../src/lib/fetch-layer.ts'

test('every request sends a webular/<version> user-agent', () =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const server = yield* Effect.acquireRelease(
          Effect.sync(() =>
            Bun.serve({
              port: 0,
              hostname: '127.0.0.1',
              maxRequestBodySize: 1024,
              fetch: (req) => new Response(req.headers.get('user-agent') ?? 'none'),
            }),
          ),
          (s) => Effect.sync(() => s.stop(true)),
        )
        const fetchPage = yield* makeFetchLayer()
        const { body } = yield* fetchPage(server.url.href)
        expect(body).toMatch(
          /^webular\/\d+\.\d+\.\d+\S* \(\+https:\/\/github\.com\/srinitude\/webular\)$/,
        )
      }),
    ),
  ))
