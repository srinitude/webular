// HTTP attempt, retry with jitter, per-host gating, and tier escalation.
import { type Deferred, Effect, Random, Semaphore, Stream } from 'effect'
import type * as HttpClient from 'effect/http/HttpClient'
import * as HttpClientRequest from 'effect/http/HttpClientRequest'
import type * as HttpClientResponse from 'effect/http/HttpClientResponse'
import { guardTarget } from '../core/address-guard.ts'
import { readTextCapped } from '../core/decode.ts'
import type { openCache, Validator } from './fetch-cache.ts'
import {
  classify,
  FetchError,
  type FetchLayerOptions,
  type FetchResult,
  fail,
  fullJitterDelay,
  type RenderTier,
} from './fetch-types.ts'

export interface Ctx {
  readonly cache: ReturnType<typeof openCache>
  readonly client: HttpClient.HttpClient
  readonly global: Semaphore.Semaphore
  /** Memory O(hosts with a call in flight or waiting): an entry leaves when its refcount hits 0. */
  readonly hosts: Map<string, { sem: Semaphore.Semaphore; refs: number }>
  /** Memory O(distinct URLs in flight): an entry leaves when its call settles. */
  readonly inflight: Map<string, Deferred.Deferred<FetchResult, FetchError>>
  readonly maxBytes: number
  readonly attempts: number
  readonly baseMs: number
  readonly capMs: number
  readonly layer: FetchLayerOptions
}

export const perHost = <A, E>(ctx: Ctx, host: string, eff: Effect.Effect<A, E>) =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const entry = ctx.hosts.get(host) ?? { sem: Semaphore.makeUnsafe(1), refs: 0 }
      entry.refs++
      ctx.hosts.set(host, entry)
      return entry
    }),
    (entry) => entry.sem.withPermits(1)(eff),
    (entry) =>
      Effect.sync(() => {
        if (--entry.refs === 0) ctx.hosts.delete(host)
      }),
  )

const conditional = (cached: Validator | null) => {
  const headers: Record<string, string> = {}
  if (cached?.etag) headers['if-none-match'] = cached.etag
  if (cached?.last_modified) headers['if-modified-since'] = cached.last_modified
  return headers
}

// Interruption (the deadline) aborts the request's AbortSignal inside HttpClient.
const MAX_HOPS = 10

// The capped reader stops pulling at the cap, so a chunked body is never fully buffered.
const readBody = (
  ctx: Ctx,
  url: string,
  res: HttpClientResponse.HttpClientResponse,
  headers: Record<string, string>,
): Effect.Effect<string, FetchError> => {
  const tooLarge = fail(url, 'too-large', 'give-up', { status: res.status })
  if (Number(headers['content-length'] ?? 0) > ctx.maxBytes) return Effect.fail(tooLarge)
  const bytes = Stream.catchIf(
    res.stream,
    (e) => e.reason._tag === 'EmptyBodyError', // a 304 or 204 has no body
    () => Stream.empty,
  )
  const web = new Response(Stream.toReadableStream(bytes), { headers })
  return Effect.mapError(readTextCapped(web, url, ctx.maxBytes), (cause) =>
    /exceeded/.test(cause.message) ? tooLarge : fail(url, 'network', 'retry', { cause }),
  )
}

// Redirects are followed here by hand, so the address guard sees every hop.
const hop = (ctx: Ctx, url: string, next: string, originPrivate: boolean, hops: number) =>
  Effect.mapError(guardTarget(next, { url, originPrivate }), (cause) =>
    fail(next, 'invalid-url', 'give-up', { cause }),
  ).pipe(Effect.andThen(Effect.suspend(() => httpOnce(ctx, next, originPrivate, hops + 1))))

const httpOnce = (
  ctx: Ctx,
  url: string,
  originPrivate: boolean,
  hops = 0,
): Effect.Effect<FetchResult, FetchError> =>
  Effect.gen(function* () {
    const cached = ctx.cache.lookup(url)
    const res = yield* Effect.mapError(
      ctx.client.execute(HttpClientRequest.get(url, { headers: conditional(cached) })),
      (cause) => fail(url, 'network', 'retry', { cause }),
    )
    const headers: Record<string, string> = { ...res.headers }
    const location = res.status >= 300 && res.status < 400 ? headers['location'] : undefined
    if (location && hops >= MAX_HOPS)
      return yield* fail(url, 'network', 'give-up', { status: res.status })
    if (location) return yield* hop(ctx, url, new URL(location, url).href, originPrivate, hops)
    const body = yield* readBody(ctx, url, res, headers)
    if (res.status === 304 && cached)
      return { url, status: 200, headers, body: cached.body, fromCache: true, tier: 'http' }
    const result = yield* classify(url, { status: res.status, body, headers }, 'http')
    if (res.status === 200 && (headers['etag'] || headers['last-modified']))
      ctx.cache.store(url, result)
    return result
  })

const retryable = (e: FetchError) =>
  e.kind === 'network' || (e.kind === 'http' && e.next_action !== 'give-up')

// Stale-if-error (RFC 5861): a 5xx after the last retry serves the stored copy, marked stale.
const staleOr = (ctx: Ctx, url: string, e: FetchError): Effect.Effect<FetchResult, FetchError> => {
  const cached = (e.status ?? 0) >= 500 ? ctx.cache.lookup(url) : null
  return cached
    ? Effect.succeed({
        url,
        status: 200,
        headers: {},
        body: cached.body,
        fromCache: true,
        stale: true,
        tier: 'http',
      })
    : Effect.fail(e)
}

/** Holds the host and global permits for one attempt only, never across a backoff sleep. */
export type Gate = <A, E>(eff: Effect.Effect<A, E>) => Effect.Effect<A, E>

export const httpWithRetry = (
  ctx: Ctx,
  url: string,
  gate: Gate,
  originPrivate: boolean,
  n = 0,
): Effect.Effect<FetchResult, FetchError> =>
  Effect.catchTag(gate(httpOnce(ctx, url, originPrivate)), 'FetchError', (e) => {
    if (!retryable(e) || n + 1 >= ctx.attempts) return staleOr(ctx, url, e)
    if (e.retryAfterMs !== undefined && e.retryAfterMs > ctx.capMs)
      return Effect.fail(new FetchError({ ...e, next_action: 'slow-down' }))
    const wait = Effect.map(
      Random.next,
      (u) => e.retryAfterMs ?? fullJitterDelay(n, ctx.baseMs, ctx.capMs, u),
    )
    return Effect.andThen(
      Effect.flatMap(wait, Effect.sleep),
      httpWithRetry(ctx, url, gate, originPrivate, n + 1),
    )
  })

const render = (url: string, tier: RenderTier): Effect.Effect<FetchResult, FetchError> =>
  Effect.acquireUseRelease(
    Effect.sync(() => new AbortController()),
    (ctl) =>
      Effect.flatMap(
        Effect.mapError(tier.render(url, ctl.signal), (cause) =>
          fail(url, 'network', 'escalate', { cause }),
        ),
        (r) =>
          classify(url, { status: r.status, body: r.body, headers: r.headers ?? {} }, tier.name),
      ),
    (ctl) => Effect.sync(() => ctl.abort()),
  )

// Escalate only on 'escalate'; tiers run in order and the last error wins.
export const escalate = (
  url: string,
  tiers: ReadonlyArray<RenderTier>,
  e: FetchError,
  gate: Gate,
  i = 0,
): Effect.Effect<FetchResult, FetchError> =>
  e.next_action !== 'escalate' || i >= tiers.length
    ? Effect.fail(e)
    : Effect.catchTag(gate(render(url, tiers[i] as RenderTier)), 'FetchError', (next) =>
        escalate(url, tiers, next, gate, i + 1),
      )
