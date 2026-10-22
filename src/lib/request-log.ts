import { appendFileSync } from 'node:fs'
import { Config, Effect, Layer, Option } from 'effect'
import * as FetchHttpClient from 'effect/http/FetchHttpClient'

// With WEBULAR_REQUEST_LOG set, every request sent through the Fetch reference
// (robots.txt reads included) appends one JSON line { method, url } to that
// file; the file is created at build, so an empty file means no request.
// The bench runner reads it into Row.requests.
export const requestLog = Layer.unwrap(
  Effect.gen(function* () {
    const file = yield* Config.option(Config.String('WEBULAR_REQUEST_LOG'))
    if (Option.isNone(file)) return Layer.empty
    const base = yield* FetchHttpClient.Fetch
    yield* Effect.sync(() => appendFileSync(file.value, ''))
    const logged = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input)
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
      appendFileSync(file.value, `${JSON.stringify({ method, url })}\n`)
      return base(input, init)
    }) as typeof globalThis.fetch
    return Layer.succeed(FetchHttpClient.Fetch, logged)
  }),
)
