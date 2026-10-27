// One HTTP attempt for src/core/http.ts: timeout, user-agent, no redirect following,
// and a FetchError with the url's secrets hidden. http.ts decides what happens next.
import { Effect, Exit, Scope } from 'effect'
import * as FetchHttpClient from 'effect/http/FetchHttpClient'
import * as HttpClient from 'effect/http/HttpClient'
import pkg from '../../package.json' with { type: 'json' }
import type { CacheOptions } from './cache.ts'
import { FetchError } from './decode.ts'
import { safeUrl } from './fetch-policy.ts'
import { errMsg } from './output.ts'

export const USER_AGENT = `webular/${pkg.version} (+https://github.com/srinitude/webular)`

export interface FetchOptions extends CacheOptions {
  timeoutMs?: number | undefined
  maxBytes?: number | undefined // body cap, MAX_TEXT_BYTES when unset
  gunzip?: boolean // fetchTextWithinHost: gunzip the body; maxBytes counts decompressed bytes
  headers?: Record<string, string>
  signal?: AbortSignal
  redirect?: RequestRedirect // 'manual' hands back the 3xx unfollowed, as fetch does
  // onResponse: every response, retries too, before its body (rate limits); hopGate: each hop.
  onResponse?: (res: Response) => void
  hopGate?: (url: string) => Effect.Effect<void, FetchError>
}

const isAbort = (err: unknown): boolean =>
  err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError')

// HttpClient over FetchHttpClient, scoped so no GC hook aborts a body mid-read.
// The caller signal or a per-attempt timeout covers headers and body; fiber
// interrupt closes the scope, aborting only while headers are pending.
const send = Effect.fn('send')(function* (url: string, opts: FetchOptions) {
  const base = yield* FetchHttpClient.Fetch
  const timeout = AbortSignal.timeout(opts.timeoutMs ?? 30_000)
  const own = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout
  let pending: Promise<Response> | undefined
  const both = (s?: AbortSignal | null) => (s ? AbortSignal.any([own, s]) : own)
  const viaOwn = ((input: RequestInfo | URL, init: RequestInit) =>
    (pending = base(input, { ...init, signal: both(init.signal) }))) as typeof globalThis.fetch
  const scope = yield* Scope.make()
  const client = HttpClient.withScope(yield* HttpClient.HttpClient)
  yield* client.get(url, { headers: { 'user-agent': USER_AGENT, ...opts.headers } }).pipe(
    Scope.provide(scope),
    Effect.onInterrupt(() => Scope.close(scope, Exit.void)),
    Effect.provideService(FetchHttpClient.Fetch, viaOwn),
    Effect.provideService(FetchHttpClient.RequestInit, { redirect: 'manual' }),
    Effect.provideService(HttpClient.TracerDisabledWhen, () => true), // no spans, no trace headers
  )
  return yield* Effect.promise(() => pending as Promise<Response>) // settled: the client resolved it
}, Effect.provide(FetchHttpClient.layer))

export const fetchOnce = (url: string, opts: FetchOptions): Effect.Effect<Response, FetchError> =>
  send(url, opts).pipe(
    Effect.mapError((err) => {
      const cause = 'cause' in err.reason ? err.reason.cause : err
      const message = errMsg(cause).replaceAll(url, safeUrl(url))
      return new FetchError({ message, aborted: isAbort(cause) })
    }),
    Effect.tap((res) => Effect.sync(() => opts.onResponse?.(res))),
  )
