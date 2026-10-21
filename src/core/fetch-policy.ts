// Fetch policy: the one source of the retry, redirect, and failure rules.
// src/machines/fetch.ts decides with them and src/core/http.ts runs that
// machine; tests/machines/policy.test.ts checks the machine reads them.

// Fixed backoff (no jitter) before each retry; its length is the retry budget.
export const RETRY_BACKOFF_MS = [250, 750] as const
export const MAX_RETRIES = RETRY_BACKOFF_MS.length
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
