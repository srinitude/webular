import { Effect, Random } from 'effect'
import { fullJitterDelay } from '../lib/fetch-types.ts'

// Fetch policy: the one source of the retry, redirect, and failure rules.
// src/machines/fetch.ts decides with them and src/core/http.ts runs that
// machine; tests/machines/policy.test.ts checks the machine reads them.

// Backoff before each retry; its length is the retry budget.
export const RETRY_BACKOFF_MS = [250, 750] as const
export const MAX_RETRIES = RETRY_BACKOFF_MS.length

// Sleep one backoff step, fully jittered (0 to ms) so clients do not retry in lockstep.
export const retryPause = (ms: number) =>
  Effect.flatMap(Random.next, (u) => Effect.sleep(fullJitterDelay(0, ms, ms, u)))
export const RETRY_STATUS: ReadonlySet<number> = new Set([408, 429, 502, 503, 504])

// Status and network failures retry; a timeout is the caller's budget, so it never does.
export const RETRY_ON_TIMEOUT = false

// Host-scoped fetches follow same-host redirects (sameHost in ./url.ts);
// this redirect fails instead of being followed.
export const REDIRECT_LIMIT = 5

// Error text for each failed final state of the fetch machine.
export const FETCH_ERROR = {
  httpFailed: (url: string, status: number, text: string) =>
    `fetch ${url} failed: ${status} ${text}`,
  offHostBlocked: (url: string) => `redirect off-site blocked: ${url}`,
  tooManyRedirects: (url: string) => `too many redirects: ${url}`,
} as const
