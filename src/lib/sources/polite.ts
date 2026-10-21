// Shared plumbing for the free source adapters in this folder: one request in
// flight per host with a minimum gap between requests, a contact User-Agent
// built from WEBULAR_MAILTO, and a Schema-checked JSON GET through the core
// fetch layer (timeout, bounded deterministic retry on 408/429/5xx, disk cache).
// ponytail: each adapter calls a documented public API endpoint, so robots.txt
// is not fetched; each host's terms and limits are in benchmarks/free-sources.md.
import { Clock, Config, Context, Effect, Schema, Semaphore } from 'effect'
import pkg from '../../../package.json' with { type: 'json' }
import { type FetchOptions, fetchText } from '../../core/http.ts'
import { HttpStatusError } from '../../core/http-body.ts'
import { endpoint } from '../sources-search.ts'

export interface Hit {
  title: string
  url: string
  description: string
  // Ranking signals (2610.11932): the source that answered, its trust in
  // [0, 1] (stamped by the registry), and the hit's date when the source has one.
  origin?: string
  trust?: number
  published?: string
}

// The tightest documented keyless limit among these hosts (Wikidata, Marginalia
// and Wayback ask for about one request a second). WEBULAR_SOURCE_GAP_MS
// overrides it, so fixture tests against a local host need not wait.
export const GAP_MS = 1_000

const gapMs = Config.Int('WEBULAR_SOURCE_GAP_MS').pipe(Config.withDefault(GAP_MS))

// Per request: every free source answers inside 2.5 s or drops out, so one slow
// host never holds a command that asks all its sources at once.
export const TIMEOUT_MS = 2_500

interface Slot {
  lock: Semaphore.Semaphore
  last: number
}

// Per-host slots, bounded by the fixed set of adapter hosts. A Reference, so
// every caller shares one table unless a test provides its own.
export const HostSlots = Context.Reference<Map<string, Slot>>('webular/sources/HostSlots', {
  defaultValue: () => new Map(),
})

const slotFor = (host: string) =>
  Effect.gen(function* () {
    const slots = yield* HostSlots
    const have = slots.get(host)
    if (have) return have
    const made = { lock: Semaphore.makeUnsafe(1), last: Number.NEGATIVE_INFINITY }
    slots.set(host, made)
    return made
  })

const stamp = (slot: Slot) =>
  Effect.flatMap(Clock.currentTimeMillis, (now) =>
    Effect.sync(() => {
      slot.last = now
    }),
  )

const spaced = <A, E, R>(slot: Slot, eff: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const wait = slot.last + (yield* gapMs) - (yield* Clock.currentTimeMillis)
    if (wait > 0) yield* Effect.sleep(wait)
    return yield* Effect.ensuring(eff, stamp(slot))
  })

// Run `eff` alone for its host, at least GAP_MS after that host's last request.
export const politely = <A, E, R>(host: string, eff: Effect.Effect<A, E, R>) =>
  Effect.flatMap(slotFor(host), (slot) => slot.lock.withPermits(1)(spaced(slot, eff)))

// Process-wide: epoch ms before which a rate-limited source is skipped, one
// Reference per source, so every caller shares it unless a test gives its own.
export type Limit = Context.Reference<{ until: number }>
export const rateLimit = (name: string): Limit =>
  Context.Reference(`webular/sources/${name}Limit`, { defaultValue: () => ({ until: 0 }) })

// When the pool is spent: retry-after on a 403/429, else x-ratelimit-reset once
// x-ratelimit-remaining is 0, else a minute on a bare 429 (GitHub's own advice).
const spentUntil = (res: Response, now: number) => {
  const after = Number(res.headers.get('retry-after'))
  if ((res.status === 403 || res.status === 429) && after > 0) return now + after * 1000
  if (res.headers.get('x-ratelimit-remaining') === '0')
    return Number(res.headers.get('x-ratelimit-reset')) * 1000
  return res.status === 429 ? now + 60_000 : 0
}

const skipped = (url: string, until: number) =>
  new HttpStatusError({
    url,
    status: 429,
    statusText: `rate limited until ${new Date(until).toISOString()}, skipped`,
  })

// After a request (success or failure), push the block out from the last response seen.
const markSpent = (block: { until: number }, seen: { res?: Response }) =>
  Effect.flatMap(Clock.currentTimeMillis, (now) =>
    Effect.sync(() => {
      if (seen.res) block.until = Math.max(block.until, spentUntil(seen.res, now))
    }),
  )

// Skip `url` with a 429 while `limit` is spent; else run `call`, which passes
// `onResponse` to its fetch so the rate-limit headers reach the block.
export const unlessLimited = <A, E, R>(
  limit: Limit,
  url: string,
  call: (onResponse: (res: Response) => void) => Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    const block = yield* limit
    if ((yield* Clock.currentTimeMillis) < block.until)
      return yield* Effect.fail(skipped(url, block.until))
    const seen: { res?: Response } = {}
    const onResponse = (res: Response) => {
      seen.res = res
    }
    return yield* Effect.ensuring(call(onResponse), markSpent(block, seen))
  })

const userAgent = Effect.map(
  Config.String('WEBULAR_MAILTO').pipe(Config.withDefault('')),
  (mailto) =>
    `webular/${pkg.version} (+https://github.com/srinitude/webular${mailto ? `; mailto:${mailto}` : ''})`,
)

// base + params, with WEBULAR_SOURCE_ORIGIN swapping the origin so tests hit a local fixture.
export const sourceUrl = endpoint

// GET base + params as JSON, politely, and decode it with `schema`. `extra`
// adds headers or a response observer for one source.
export const getJson = Effect.fn('sourceGet')(function* <A>(
  schema: Schema.Codec<A, string>,
  base: string,
  params: Record<string, string>,
  extra: FetchOptions = {},
) {
  const headers = { 'user-agent': yield* userAgent, accept: 'application/json', ...extra.headers }
  const opts = { ...extra, timeoutMs: TIMEOUT_MS, headers }
  const get = fetchText(yield* sourceUrl(base, params), opts)
  const body = yield* politely(new URL(base).host, get)
  return yield* Schema.decodeUnknownEffect(schema)(body)
})
