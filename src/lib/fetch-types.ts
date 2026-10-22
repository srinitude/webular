// Fetch layer types, typed errors, backoff math, and reply classification.
import { Clock, Data, Effect } from 'effect'
import { delayHeaderMs } from '../core/retry-after.ts'

type FetchErrorKind = 'timeout' | 'network' | 'http' | 'blocked' | 'too-large' | 'invalid-url'
type NextAction = 'retry' | 'escalate' | 'give-up' | 'slow-down'

export class FetchError extends Data.TaggedError('FetchError')<{
  readonly kind: FetchErrorKind
  readonly next_action: NextAction
  readonly url: string
  readonly status?: number | undefined
  readonly retryAfterMs?: number | undefined
  /** Why a `blocked` fetch was refused; `robots` carries the matched rule. */
  readonly reason?: 'robots' | undefined
  readonly rule?: string | undefined
  readonly cause?: unknown
}> {}

export interface FetchResult {
  readonly url: string
  readonly status: number
  readonly headers: Record<string, string>
  readonly body: string
  readonly fromCache: boolean
  /** Set when the origin failed with a 5xx and the stored copy stood in (stale-if-error). */
  readonly stale?: true
  readonly tier: string
}

export interface RenderTier {
  readonly name: string
  readonly render: (
    url: string,
    signal: AbortSignal,
  ) => Effect.Effect<{ status: number; body: string; headers?: Record<string, string> }, unknown>
}

interface CallOptions {
  readonly deadlineMs?: number | undefined
  readonly tiers?: ReadonlyArray<RenderTier>
}

export interface FetchLayerOptions extends CallOptions {
  /** SQLite file for validators; the webular cache folder when absent. */
  readonly cachePath?: string
  readonly cacheRows?: number
  readonly globalSockets?: number
  readonly maxBytes?: number
  readonly retry?: { readonly attempts?: number; readonly baseMs?: number; readonly capMs?: number }
}

export type FetchPage = (url: string, opts?: CallOptions) => Effect.Effect<FetchResult, FetchError>

/** Full jitter (Brooker, AWS): u in [0, 1) scaled to [0, min(cap, base * 2^attempt)]. */
export const fullJitterDelay = (attempt: number, baseMs: number, capMs: number, u: number) =>
  u * Math.min(capMs, baseMs * 2 ** attempt)

/** `Retry-After` as delta-seconds or HTTP-date (RFC 9110), in ms; undefined when absent or bad. */
const parseRetryAfter = delayHeaderMs

const CHALLENGE = /cf-chl|captcha|enable javascript|checking your browser/i

export interface Reply {
  readonly status: number
  readonly body: string
  readonly headers: Record<string, string>
}

export const fail = (
  url: string,
  kind: FetchErrorKind,
  next_action: NextAction,
  extra: Partial<FetchError> = {},
) => new FetchError({ url, kind, next_action, ...extra })

/** Fails on a reply that is not usable content; 401/403, empty, or challenge pages ask to escalate. */
export const classify = (url: string, r: Reply, tier: string) =>
  Effect.flatMap(Clock.currentTimeMillis, (now): Effect.Effect<FetchResult, FetchError> => {
    const { status } = r
    const retryAfterMs = parseRetryAfter(r.headers['retry-after'], now)
    if (
      status === 401 ||
      status === 403 ||
      (status < 300 && r.body.trim() === '') ||
      CHALLENGE.test(r.body)
    )
      return Effect.fail(fail(url, 'blocked', 'escalate', { status }))
    if (status === 429) return Effect.fail(fail(url, 'http', 'slow-down', { status, retryAfterMs }))
    if (status >= 500) return Effect.fail(fail(url, 'http', 'retry', { status, retryAfterMs }))
    if (status >= 400) return Effect.fail(fail(url, 'http', 'give-up', { status }))
    return Effect.succeed({ url, ...r, fromCache: false, tier })
  })
