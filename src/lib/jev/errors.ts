// Jev HTTP failures: status to webular error kind and next action
// (docs.typesafe.ai/api/errors), plus retry-after parsing.
import { Data } from 'effect'
import { delayHeaderMs } from '../../core/retry-after.ts'

type JevErrorKind =
  | 'bad_request'
  | 'auth'
  | 'forbidden'
  | 'not_found'
  | 'invalid'
  | 'rate_limited'
  | 'server'
  | 'timeout'
  | 'network'
  | 'no_key'

const KINDS: Record<JevErrorKind, { readonly next: string; readonly retry: boolean }> = {
  bad_request: { next: 'fix the payload: caps, UTF-8, or context length', retry: false },
  auth: { next: 'check TYPESAFE_API_KEY or the Keychain item typesafe-ai-api-key', retry: false },
  forbidden: { next: 'check that the account may use this model', retry: false },
  not_found: { next: 'check the model id; the pinned release answers instead', retry: false },
  invalid: { next: 'fix the question shape named in the error body', retry: false },
  rate_limited: { next: 'wait retryAfterMs, then retry once; else use the code rule', retry: true },
  server: { next: 'retry once with jitter; else use the code rule', retry: true },
  timeout: { next: 'retry once with jitter; else use the code rule', retry: true },
  network: { next: 'retry once with jitter; else use the code rule', retry: true },
  no_key: { next: 'set a TypeSafe key; the code rule decides meanwhile', retry: false },
}

const BY_STATUS: Readonly<Record<number, JevErrorKind>> = {
  400: 'bad_request',
  401: 'auth',
  403: 'forbidden',
  404: 'not_found',
  422: 'invalid',
  429: 'rate_limited',
}
export const errorKind = (status: number): JevErrorKind =>
  BY_STATUS[status] ?? (status >= 500 ? 'server' : 'bad_request')
export const nextAction = (kind: JevErrorKind) => KINDS[kind].next
export const retryable = (kind: JevErrorKind) => KINDS[kind].retry

// `retry-after-ms`, else `retry-after` in seconds or as an HTTP date.
export const retryAfterMs = (
  headers: Readonly<Record<string, string | undefined>>,
  now: number,
) => {
  const ms = headers['retry-after-ms']?.trim()
  if (ms && /^\d+(\.\d+)?$/.test(ms)) return Number(ms)
  return delayHeaderMs(headers['retry-after'], now)
}

export class JevError extends Data.TaggedError('JevError')<{
  reason: string
  kind?: JevErrorKind
  retryAfterMs?: number | undefined
}> {}

// A payload over its token budget: refused before the call, so the fallback decides.
export class JevPayloadTooLarge extends Data.TaggedError('JevPayloadTooLarge')<{
  decision: string
  tokens: number
  cap: number
}> {
  override get message() {
    return `Jev payload for ${this.decision} is ${this.tokens} tokens, over the cap of ${this.cap}`
  }
}
