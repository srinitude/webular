// The Jev docs fetch names webular and reads the body under a byte cap.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import * as FetchHttpClient from 'effect/http/FetchHttpClient'
import * as HttpClient from 'effect/http/HttpClient'
import { httpFetcher } from '../../src/lib/jev/docs-fetch.ts'
import { startFixture } from '../_support/fixture.ts'

const withDocs = <A, E>(
  routes: Record<string, (req: Request) => Response>,
  use: (origin: string, http: HttpClient.HttpClient) => Effect.Effect<A, E>,
) =>
  Effect.gen(function* () {
    const fx = yield* startFixture(() => routes)
    const http = yield* HttpClient.HttpClient
    return yield* use(fx.origin, http)
  }).pipe(Effect.scoped, Effect.provide(FetchHttpClient.layer), Effect.runPromise)

test('docs fetch sends the webular User-Agent', () =>
  withDocs(
    { '/docs': (req) => new Response(req.headers.get('user-agent') ?? '') },
    (origin, http) =>
      httpFetcher(http)(`${origin}/docs`, {}).pipe(
        Effect.map((r) => expect(r.text).toStartWith('webular/')),
      ),
  ))

test(
  'docs body over the cap fails instead of buffering whole',
  () =>
    withDocs(
      {
        '/docs': () =>
          new Response(
            new ReadableStream({
              pull(c) {
                c.enqueue(new Uint8Array(1024).fill(0x61))
              },
            }),
          ),
      },
      (origin, http) =>
        Effect.flip(httpFetcher(http, 4096)(`${origin}/docs`, {})).pipe(
          Effect.map((e) => expect(String(e)).toContain('exceeded 4096 bytes')),
        ),
    ),
  20_000,
)
