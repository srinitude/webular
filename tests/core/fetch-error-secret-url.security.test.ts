// A network failure's error text never carries a query secret from the request URL.
import { afterEach, expect, test } from 'bun:test'
import { Effect } from 'effect'
import { httpGet } from '../../src/core/http.ts'

const SECRET = 'SUPERSECRET123'
const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

// Some runtimes put the full request URL in the connect-error text.
const failing = Effect.gen(function* () {
  globalThis.fetch = ((input: RequestInfo | URL) =>
    Effect.runPromise(
      Effect.fail(new TypeError(`Unable to connect to ${String(input)}`)),
    )) as unknown as typeof fetch
  const url = `http://127.0.0.1:9/x?api_key=${SECRET}&q=1`
  return yield* Effect.flip(httpGet(url, { retry: { attempts: 1 } } as never))
})

const program = Effect.gen(function* () {
  const error = yield* failing
  expect(error.message).toContain('127.0.0.1:9')
  expect(error.message).not.toContain(SECRET)
})

test('a network error does not leak ?api_key into the FetchError message', () =>
  Effect.runPromise(program))
