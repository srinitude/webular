// Webular's one fetch layer: per-call deadline with real abort, RFC 9111
// conditional GET backed by a bounded bun:sqlite validator cache, full-jitter
// retries (the only retry layer), typed errors with a next action, tiered
// escalation to a caller-supplied render hook, and bounded sockets
// (16 overall, one per host).
import { Effect, type Scope, Semaphore } from 'effect'
import * as FetchHttpClient from 'effect/http/FetchHttpClient'
import * as HttpClient from 'effect/http/HttpClient'
import { openCache } from './fetch-cache.ts'
import { type Ctx, escalate, type Gate, httpWithRetry, perHost } from './fetch-http.ts'
import { type FetchError, type FetchLayerOptions, type FetchPage, fail } from './fetch-types.ts'
import { closeSqlite } from './sqlite-open.ts'

export {
  type FetchError,
  type FetchLayerOptions,
  type FetchPage,
  fullJitterDelay,
} from './fetch-types.ts'

const parseUrl = (url: string) =>
  Effect.flatMap(
    Effect.try({
      try: () => new URL(url),
      catch: (cause) => fail(url, 'invalid-url', 'give-up', { cause }),
    }),
    (u) =>
      u.protocol === 'http:' || u.protocol === 'https:'
        ? Effect.succeed(u)
        : Effect.fail(fail(url, 'invalid-url', 'give-up')),
  )

const fetchWith =
  (ctx: Ctx): FetchPage =>
  (url, opts = {}) =>
    Effect.flatMap(parseUrl(url), (u) => {
      const tiers = opts.tiers ?? ctx.layer.tiers ?? []
      const gate: Gate = (eff) => perHost(ctx, u.host, ctx.global.withPermits(1)(eff))
      const work = Effect.catchTag(httpWithRetry(ctx, u.href, gate), 'FetchError', (e) =>
        escalate(u.href, tiers, e, gate),
      )
      // The deadline covers queueing, retries, and tiers.
      return Effect.timeoutOrElse(work, {
        duration: opts.deadlineMs ?? ctx.layer.deadlineMs ?? 10_000,
        orElse: () => Effect.fail(fail(url, 'timeout', 'retry')),
      })
    })

/** Builds the fetch closure. The Scope owns the validator database; semaphores live in the closure. */
export const makeFetchLayer = (
  layer: FetchLayerOptions = {},
): Effect.Effect<FetchPage, FetchError, Scope.Scope> =>
  Effect.gen(function* () {
    const path = layer.cachePath ?? ':memory:'
    const cache = yield* Effect.acquireRelease(
      Effect.try({
        try: () => openCache(path, layer.cacheRows ?? 1024),
        catch: (cause) => fail(path, 'network', 'give-up', { cause }),
      }),
      (c) => Effect.sync(() => closeSqlite(c.db)),
    )
    const client = yield* Effect.provide(
      Effect.gen(function* () {
        return yield* HttpClient.HttpClient
      }),
      FetchHttpClient.layer,
    )
    return fetchWith({
      cache,
      client,
      global: yield* Semaphore.make(layer.globalSockets ?? 16),
      hosts: new Map(),
      maxBytes: layer.maxBytes ?? 10 * 1024 * 1024,
      attempts: layer.retry?.attempts ?? 3,
      baseMs: layer.retry?.baseMs ?? 200,
      capMs: layer.retry?.capMs ?? 10_000,
      layer,
    })
  })
