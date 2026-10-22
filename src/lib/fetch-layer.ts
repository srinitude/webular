// Webular's one fetch layer: per-call deadline with real abort, RFC 9111
// conditional GET backed by a bounded bun:sqlite validator cache, full-jitter
// retries (the only retry layer), typed errors with a next action, tiered
// escalation to a caller-supplied render hook, and bounded sockets
// (16 overall, one per host).
import { BunServices } from '@effect/platform-bun'
import {
  Config,
  Deferred,
  Effect,
  Exit,
  FileSystem,
  Layer,
  Path,
  type Scope,
  Semaphore,
} from 'effect'
import * as FetchHttpClient from 'effect/http/FetchHttpClient'
import * as HttpClient from 'effect/http/HttpClient'
import { setHeader } from 'effect/http/HttpClientRequest'
import { guardTarget } from '../core/address-guard.ts'
import { USER_AGENT } from '../core/http.ts'
import { openCache } from './fetch-cache.ts'
import { type Ctx, escalate, type Gate, httpWithRetry, perHost } from './fetch-http.ts'
import {
  type FetchError,
  type FetchLayerOptions,
  type FetchPage,
  type FetchResult,
  fail,
} from './fetch-types.ts'
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
        ? Effect.mapBoth(guardTarget(u.href), {
            onFailure: (cause) => fail(url, 'invalid-url', 'give-up', { cause }),
            onSuccess: (originPrivate) => ({ u, originPrivate }),
          })
        : Effect.fail(fail(url, 'invalid-url', 'give-up')),
  )

// Single-flight: a call for a URL already in flight (same tiers) waits on that
// call's result instead of sending its own GET. The entry leaves when it settles.
// A waiter whose leader hit its deadline gets a 'timeout' error, never the interrupt.
const joined = (ctx: Ctx, url: string, key: string, work: Effect.Effect<FetchResult, FetchError>) =>
  Effect.suspend(() => {
    const seen = ctx.inflight.get(key)
    if (seen) return Deferred.await(seen)
    const done = Deferred.makeUnsafe<FetchResult, FetchError>()
    ctx.inflight.set(key, done)
    return Effect.onExit(work, (exit) =>
      Effect.andThen(
        Effect.sync(() => ctx.inflight.delete(key)),
        Deferred.done(
          done,
          Exit.hasInterrupts(exit) ? Exit.fail(fail(url, 'timeout', 'retry')) : exit,
        ),
      ),
    )
  })

const fetchWith =
  (ctx: Ctx): FetchPage =>
  (url, opts = {}) =>
    Effect.flatMap(parseUrl(url), ({ u, originPrivate }) => {
      const tiers = opts.tiers ?? ctx.layer.tiers ?? []
      const gate: Gate = (eff) => perHost(ctx, u.host, ctx.global.withPermits(1)(eff))
      const http = httpWithRetry(ctx, u.href, gate, originPrivate)
      const work = Effect.catchTag(http, 'FetchError', (e) => escalate(u.href, tiers, e, gate))
      const key = [u.href, ...tiers.map((t) => t.name)].join(' ')
      // The deadline covers queueing, retries, and tiers.
      return Effect.timeoutOrElse(joined(ctx, url, key, work), {
        duration: opts.deadlineMs ?? ctx.layer.deadlineMs ?? 10_000,
        orElse: () => Effect.fail(fail(url, 'timeout', 'retry')),
      })
    })

// WEBULAR_CACHE_DIR/fetch-validators.sqlite (default ~/.cache/webular, next to the
// local index), so validators outlive one command; in memory when WEBULAR_NO_CACHE=1.
const validatorPath = Effect.gen(function* () {
  const off = yield* Config.String('WEBULAR_NO_CACHE').pipe(Config.withDefault(''))
  if (off === '1') return ':memory:'
  const path = yield* Path.Path
  const home = yield* Config.String('HOME').pipe(
    Config.orElse(() => Config.String('USERPROFILE')),
    Config.withDefault('.'),
  )
  const dir = yield* Config.String('WEBULAR_CACHE_DIR').pipe(
    Config.withDefault(path.join(home, '.cache', 'webular')),
  )
  yield* (yield* FileSystem.FileSystem).makeDirectory(dir, { recursive: true })
  return path.join(dir, 'fetch-validators.sqlite')
}).pipe(
  Effect.provide(BunServices.layer),
  Effect.mapError((cause) => fail('fetch-validators.sqlite', 'network', 'give-up', { cause })),
)

// Redirects come back to httpOnce, which checks each hop (src/core/address-guard.ts).
const manualRedirects = Layer.mergeAll(
  FetchHttpClient.layer,
  Layer.succeed(FetchHttpClient.RequestInit, { redirect: 'manual' }),
)

/** Builds the fetch closure. The Scope owns the validator database; semaphores live in the closure. */
export const makeFetchLayer = (
  layer: FetchLayerOptions = {},
): Effect.Effect<FetchPage, FetchError, Scope.Scope> =>
  Effect.gen(function* () {
    const path = layer.cachePath ?? (yield* validatorPath)
    const cache = yield* Effect.acquireRelease(
      Effect.try({
        try: () => openCache(path, layer.cacheRows ?? 1024),
        catch: (cause) => fail(path, 'network', 'give-up', { cause }),
      }),
      (c) => Effect.sync(() => closeSqlite(c.db)),
    )
    const client = yield* Effect.provide(
      Effect.map(HttpClient.HttpClient, HttpClient.mapRequest(setHeader('user-agent', USER_AGENT))),
      manualRedirects,
    )
    return fetchWith({
      cache,
      client,
      global: yield* Semaphore.make(layer.globalSockets ?? 16),
      hosts: new Map(),
      inflight: new Map(),
      maxBytes: layer.maxBytes ?? 10 * 1024 * 1024,
      attempts: layer.retry?.attempts ?? 3,
      baseMs: layer.retry?.baseMs ?? 200,
      capMs: layer.retry?.capMs ?? 10_000,
      layer,
    })
  })
