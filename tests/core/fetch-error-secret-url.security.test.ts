// A network failure's error text never carries a query secret from the request URL.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import * as FetchHttpClient from 'effect/http/FetchHttpClient'
import { httpGet } from '../../src/core/http.ts'

const SECRET = 'SUPERSECRET123'

// Some runtimes put the full request URL in the connect-error text. The fetch
// goes in through FetchHttpClient.Fetch, the reference httpGet reads: Effect
// caches that reference's globalThis.fetch default on first use, so patching
// globalThis.fetch misses whenever an earlier test in the process fetched.
const refused = ((input: RequestInfo | URL) =>
  Effect.runPromise(
    Effect.fail(new TypeError(`Unable to connect to ${String(input)}`)),
  )) as unknown as typeof fetch

const failing = Effect.gen(function* () {
  const url = `http://127.0.0.1:9/x?api_key=${SECRET}&q=1`
  return yield* Effect.flip(httpGet(url, { retry: { attempts: 1 } } as never))
}).pipe(Effect.provideService(FetchHttpClient.Fetch, refused))

const program = Effect.gen(function* () {
  const error = yield* failing
  expect(error.message).toContain('127.0.0.1:9')
  expect(error.message).not.toContain(SECRET)
})

test('a network error does not leak ?api_key into the FetchError message', () =>
  Effect.runPromise(program))
