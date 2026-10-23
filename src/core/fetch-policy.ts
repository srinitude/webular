import { Context, Effect, Random } from 'effect'
import { fullJitterDelay } from '../lib/fetch-types.ts'

// Fetch policy: the one source of the retry, redirect, and failure rules.
// src/machines/fetch.ts decides with them and src/core/http.ts runs that
// machine; tests/machines/policy.test.ts checks the machine reads them.

// Backoff before each retry; its length is the per-request retry count.
export const RETRY_BACKOFF_MS = [250, 750] as const
export const MAX_RETRIES = RETRY_BACKOFF_MS.length

// Sleep one backoff step, fully jittered (0 to ms) so clients do not retry in lockstep.
export const retryPause = (ms: number) =>
  Effect.flatMap(Random.next, (u) => Effect.sleep(fullJitterDelay(0, ms, ms, u)))

// Per-host retry budget and breaker: a host's retries stop once it has used FLOOR + RATIO x its
// requests, or after BREAKER_FAILS failed attempts in a row (until it answers again). First
// attempts always go out, so a failing host costs about 1.2x its requests, not 3x.
export const RETRY_BUDGET = { floor: 10, ratio: 0.2, breakerFails: 5 } as const
interface HostRetry {
  requests: number
  retries: number
  failsInRow: number
}
// ponytail: counts live for the process with no decay; add a rolling window for long-lived servers.
export const HostRetries = Context.Reference<Map<string, HostRetry>>('webular/core/HostRetries', {
  defaultValue: () => new Map(),
})
const hostState = (url: string) =>
  Effect.map(HostRetries, (hosts) => {
    const host = URL.parse(url)?.host ?? url
    const have = hosts.get(host) ?? { requests: 0, retries: 0, failsInRow: 0 }
    hosts.set(host, have)
    return have
  })
export const countRequest = (url: string) => Effect.map(hostState(url), (s) => void s.requests++)
export const noteAttempt = (url: string, failed: boolean) =>
  Effect.map(hostState(url), (s) => {
    s.failsInRow = failed ? s.failsInRow + 1 : 0
  })
// True, and spends one retry, when the host's budget and breaker both allow it.
export const takeRetry = (url: string) =>
  Effect.map(hostState(url), (s) => {
    const { floor, ratio, breakerFails } = RETRY_BUDGET
    const ok = s.failsInRow < breakerFails && s.retries < floor + ratio * s.requests
    if (ok) s.retries++
    return ok
  })
export const RETRY_STATUS: ReadonlySet<number> = new Set([408, 429, 502, 503, 504])

// Status and network failures retry; a timeout is the caller's budget, so it never does.
export const RETRY_ON_TIMEOUT = false

// Host-scoped fetches follow same-host redirects (sameHost in ./url.ts);
// this redirect fails instead of being followed.
export const REDIRECT_LIMIT = 5

// A key sent as a query parameter (OpenAlex api_key) never reaches error text.
const SECRET_PARAM = /key|token|secret|password|auth|sig/i
export const safeUrl = (url: string) => {
  const u = URL.parse(url)
  if (!u) return url
  for (const name of [...u.searchParams.keys()])
    if (SECRET_PARAM.test(name)) u.searchParams.set(name, 'REDACTED')
  return u.toString()
}

// Error text for each failed final state of the fetch machine.
export const FETCH_ERROR = {
  httpFailed: (url: string, status: number, text: string) =>
    `fetch ${safeUrl(url)} failed: ${status} ${text}`,
  offHostBlocked: (url: string) => `redirect off-site blocked: ${safeUrl(url)}`,
  tooManyRedirects: (url: string) => `too many redirects: ${safeUrl(url)}`,
} as const
