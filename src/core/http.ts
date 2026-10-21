// Bun.fetch layer: timeout, user-agent, scoped redirects, textual-content guard,
// deterministic bounded retry, disk-cache revalidation.
import { BunServices } from '@effect/platform-bun'
import { Data, Effect } from 'effect'
import pkg from '../../package.json' with { type: 'json' }
import { type CacheOptions, cachedGetText } from './cache.ts'
import { FetchError, readTextCapped } from './decode.ts'
import { sameHost } from './url.ts'

const USER_AGENT = `webular/${pkg.version} (+https://github.com/srinitude/webular)`
const MAX_TEXT_BYTES = 25 * 1024 * 1024

// MIME types accepted by text fetches; anything else errors instead of
// decoding binary bytes into garbage markdown.
const TEXTUAL_MIMES = new Set([
  'application/json',
  'application/xml',
  'application/javascript',
  'application/x-javascript',
  'application/xhtml+xml',
])

// Deterministic retry policy: fixed backoff (no jitter), fixed attempt count.
const RETRY_BACKOFF_MS = [250, 750]
const RETRY_STATUS = new Set([408, 429, 502, 503, 504])
// A server's Retry-After wins over the fixed backoff, capped so a huge or
// hostile value cannot stall the CLI.
const MAX_RETRY_AFTER_MS = 10_000

export interface FetchOptions extends CacheOptions {
  timeoutMs?: number | undefined
  headers?: Record<string, string>
  signal?: AbortSignal
  redirect?: RequestRedirect
}

// A non-2xx response, typed so callers branch on the status, not the message.
// The message is an own field, not a getter: Mastra copies a step error's own
// fields, so a prototype getter reaches the CLI as "failed (undefined)".
export class HttpStatusError extends Data.TaggedError('HttpStatusError')<{
  url: string
  status: number
  statusText: string
}> {
  override message = `fetch ${this.url} failed: ${this.status} ${this.statusText}`
}

// Retry-After (RFC 9110 section 10.2.3): delay-seconds or an HTTP-date.
export function retryAfterMs(header: string | null, now = Date.now()): number | undefined {
  if (!header?.trim()) return undefined
  const secs = Number(header)
  const ms = Number.isFinite(secs) ? secs * 1000 : Date.parse(header) - now
  if (!Number.isFinite(ms) || ms < 0) return undefined
  return Math.min(ms, MAX_RETRY_AFTER_MS)
}

const fetchOnce = (url: string, opts: FetchOptions) =>
  Effect.tryPromise({
    try: () =>
      fetch(url, {
        headers: { 'user-agent': USER_AGENT, ...opts.headers },
        redirect: opts.redirect ?? 'follow',
        // A fresh per-attempt budget unless the caller owns the signal lifecycle.
        signal: opts.signal ?? AbortSignal.timeout(opts.timeoutMs ?? 30_000),
      }),
    catch: (err) => err,
  })

const toFetchError = (err: unknown) =>
  err instanceof FetchError
    ? err
    : new FetchError({ message: err instanceof Error ? err.message : String(err) })

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError')
}

type Attempt =
  | { kind: 'response'; res: Response }
  | { kind: 'retry'; waitMs?: number }
  | { kind: 'raise'; err: unknown }

// Release an unread body so the pooled connection is freed at once instead of
// waiting for GC (Bun guide BUN027). A stream already locked by its reader was
// cancelled by that reader, so a failed cancel is ignored.
const dropBody = (res: Response) =>
  Effect.ignore(
    Effect.tryPromise({ try: () => res.body?.cancel() ?? Promise.resolve(), catch: (err) => err }),
  )

const attemptGet = (url: string, opts: FetchOptions, last: boolean): Effect.Effect<Attempt> =>
  fetchOnce(url, opts).pipe(
    Effect.flatMap((res) =>
      !RETRY_STATUS.has(res.status) || last
        ? Effect.succeed<Attempt>({ kind: 'response', res })
        : Effect.as(dropBody(res), {
            kind: 'retry',
            waitMs: retryAfterMs(res.headers.get('retry-after')),
          } as Attempt),
    ),
    // A timeout/abort is the caller's budget — retrying would silently exceed it.
    Effect.catch((err) =>
      Effect.succeed<Attempt>(isAbort(err) || last ? { kind: 'raise', err } : { kind: 'retry' }),
    ),
  )

// GET with retry: network-level throws and 408/429/502/503/504 responses retry
// on the fixed backoff (or the server's Retry-After); other statuses return as-is.
export const httpGet = Effect.fn('httpGet')(function* (url: string, opts: FetchOptions = {}) {
  for (let attempt = 0; ; attempt++) {
    const outcome = yield* attemptGet(url, opts, attempt >= RETRY_BACKOFF_MS.length)
    if (outcome.kind === 'response') return outcome.res
    if (outcome.kind === 'raise') return yield* Effect.fail(toFetchError(outcome.err))
    yield* Effect.sleep(outcome.waitMs ?? RETRY_BACKOFF_MS[attempt] ?? 750)
  }
})

// The refused MIME type, or undefined when the body is text.
function refusedMime(res: Response): string | undefined {
  const header = res.headers.get('content-type')
  if (!header) return undefined
  const mime = (header.split(';')[0] ?? '').trim().toLowerCase()
  const ok =
    mime === '' ||
    mime.startsWith('text/') ||
    mime.endsWith('+xml') ||
    mime.endsWith('+json') ||
    TEXTUAL_MIMES.has(mime)
  return ok ? undefined : mime
}

const readOk = Effect.fn('readOk')(function* (res: Response, url: string) {
  if (!res.ok)
    return yield* new HttpStatusError({ url, status: res.status, statusText: res.statusText })
  const bad = refusedMime(res)
  if (bad !== undefined)
    return yield* new FetchError({
      message: `fetch ${url}: unsupported content-type "${bad}" — use media --download`,
    })
  return yield* readTextCapped(res, url, MAX_TEXT_BYTES)
})

// Every rejected response releases its body.
const okText = (res: Response, url: string) =>
  readOk(res, url).pipe(Effect.tapError(() => dropBody(res)))

// Text GETs revalidate through the disk cache; a cache config error surfaces
// as a FetchError, so callers see only HttpStatusError or FetchError.
export const fetchText = (
  url: string,
  opts: FetchOptions = {},
): Effect.Effect<string, HttpStatusError | FetchError> =>
  cachedGetText<HttpStatusError | FetchError>(
    url,
    (h) => httpGet(url, { ...opts, headers: { ...opts.headers, ...h } }),
    (res) => okText(res, url),
    opts,
  ).pipe(
    Effect.catchTag('ConfigError', (err) => Effect.fail(toFetchError(err))),
    Effect.provide(BunServices.layer),
  )

// The ROOT of a crawl/map is the user's explicit target: follow its redirects
// freely (apex→www) and report the FINAL url to re-anchor the host scope on.
export const fetchRoot = Effect.fn('fetchRoot')(function* (url: string, opts: FetchOptions = {}) {
  const res = yield* httpGet(url, opts)
  return { finalUrl: res.url || url, html: yield* okText(res, url) }
})

const isRedirect = (status: number) => status >= 300 && status < 400

// Fetch text but follow redirects MANUALLY, blocking any hop that leaves `host`
// (EXACT hostname match — scope control for crawls, not an IP/SSRF filter).
export const fetchTextWithinHost = Effect.fn('fetchTextWithinHost')(function* (
  url: string,
  host: string,
  opts: FetchOptions = {},
) {
  let current = url
  for (let hop = 0; hop < 5; hop++) {
    const res = yield* httpGet(current, { ...opts, redirect: 'manual' })
    const location = isRedirect(res.status) ? res.headers.get('location') : null
    if (!location) return yield* okText(res, current)
    yield* dropBody(res) // the hop's body is never read; free its connection
    current = new URL(location, current).toString()
    if (!sameHost(host, current))
      return yield* new FetchError({ message: `redirect off-site blocked: ${current}` })
  }
  return yield* new FetchError({ message: `too many redirects: ${url}` })
})
