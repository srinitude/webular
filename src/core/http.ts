// Bun.fetch layer: timeout, user-agent, scoped redirects, textual-content guard,
// deterministic bounded retry, disk-cache revalidation. The fetch machine
// (src/machines/fetch.ts) decides every retry, redirect, and failure; this
// file only performs the requests it asks for.
import { BunServices } from '@effect/platform-bun'
import { Clock, Effect } from 'effect'
import { type EventFromLogic, initialTransition, type SnapshotFrom, transition } from 'xstate'
import pkg from '../../package.json' with { type: 'json' }
import { failureEvent, fetchMachine } from '../machines/fetch.ts'
import { type CacheOptions, cachedGetText } from './cache.ts'
import { FetchError } from './decode.ts'
import { FETCH_ERROR, RETRY_BACKOFF_MS, RETRY_STATUS } from './fetch-policy.ts'
import { dropBody, type HttpStatusError, okText } from './http-body.ts'
import { errMsg } from './output.ts'
import { sameHost } from './url.ts'

const USER_AGENT = `webular/${pkg.version} (+https://github.com/srinitude/webular)`

// A server's Retry-After wins over the fixed backoff, capped so a huge or
// hostile value cannot stall the CLI.
const MAX_RETRY_AFTER_MS = 10_000

export interface FetchOptions extends CacheOptions {
  timeoutMs?: number | undefined
  maxBytes?: number | undefined // body cap, MAX_TEXT_BYTES when unset
  headers?: Record<string, string>
  signal?: AbortSignal
  redirect?: RequestRedirect
}

// Retry-After (RFC 9110 section 10.2.3): delay-seconds or an HTTP-date.
export function retryAfterMs(header: string | null, now: number): number | undefined {
  if (!header?.trim()) return undefined
  const secs = Number(header)
  const ms = Number.isFinite(secs) ? secs * 1000 : Date.parse(header) - now
  if (!Number.isFinite(ms) || ms < 0) return undefined
  return Math.min(ms, MAX_RETRY_AFTER_MS)
}

type FetchSnapshot = SnapshotFrom<typeof fetchMachine>
type FetchEvent = EventFromLogic<typeof fetchMachine>

const [START] = initialTransition(fetchMachine)
const step = (snap: FetchSnapshot, event: FetchEvent) => transition(fetchMachine, snap, event)[0]

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError')
}

const fetchOnce = (url: string, opts: FetchOptions): Effect.Effect<Response, FetchError> =>
  Effect.tryPromise({
    try: (interrupt) =>
      fetch(url, {
        headers: { 'user-agent': USER_AGENT, ...opts.headers },
        redirect: opts.redirect ?? 'follow',
        // A fresh per-attempt budget unless the caller owns the signal lifecycle.
        signal: AbortSignal.any([
          opts.signal ?? AbortSignal.timeout(opts.timeoutMs ?? 30_000),
          interrupt,
        ]),
      }),
    catch: (err) => new FetchError({ message: errMsg(err), aborted: isAbort(err) }),
  })

const isRedirect = (status: number) => status >= 300 && status < 400

// One fetch run. With `host` set, redirects are followed by hand within it.
// `deadline` is the wall time after which a retry would outlast the caller's timeout.
interface Run {
  origin: string
  host?: string | undefined
  opts: FetchOptions
  deadline: number
}

const startRun = (origin: string, opts: FetchOptions, host?: string) =>
  Effect.map(
    Clock.currentTimeMillis,
    (now): Run => ({
      origin,
      host,
      opts,
      deadline: now + (opts.timeoutMs ?? Number.POSITIVE_INFINITY),
    }),
  )

interface Landed {
  res: Response
  url: string
}

// Names a response as a machine event, with the url the next step uses.
function responseEvent(run: Run, res: Response, url: string): Landed & { event: FetchEvent } {
  const settled = { res, url, event: { type: res.ok ? 'OK' : 'HTTP_ERROR' } } as const
  if (RETRY_STATUS.has(res.status)) return { res, url, event: { type: 'RETRYABLE_STATUS' } }
  if (run.host === undefined || !isRedirect(res.status)) return settled
  const location = res.headers.get('location')
  if (!location) return settled
  const next = new URL(location, url).toString()
  const type = sameHost(run.host, next) ? 'REDIRECT_SAME_HOST' : 'REDIRECT_OFF_HOST'
  return { res, url: next, event: { type } }
}

const retry = (run: Run, url: string, snap: FetchSnapshot, waitMs?: number) =>
  Effect.andThen(
    Effect.sleep(waitMs ?? RETRY_BACKOFF_MS[snap.context.attempt - 1] ?? 750),
    Effect.suspend(() => drive(run, url, snap)),
  )

// A rejected redirect's body is never read; free its connection.
function settle(run: Run, snap: FetchSnapshot, landed: Landed): Effect.Effect<Landed, FetchError> {
  const blocked = snap.matches('offHostBlocked')
  if (!blocked && !snap.matches('tooManyRedirects')) return Effect.succeed(landed)
  const message = blocked
    ? FETCH_ERROR.offHostBlocked(landed.url)
    : FETCH_ERROR.tooManyRedirects(run.origin)
  return Effect.andThen(dropBody(landed.res), Effect.fail(new FetchError({ message })))
}

// Fetch, name the outcome as an event, and do what the machine's next state says.
// A retried status waits the server's Retry-After when it sends one; a wait past
// the deadline returns the status at once instead.
function drive(run: Run, url: string, snap: FetchSnapshot): Effect.Effect<Landed, FetchError> {
  return Effect.matchEffect(fetchOnce(url, run.opts), {
    onFailure: (err) =>
      Effect.flatMap(failureEvent(snap, err.aborted === true), (event) => {
        const next = step(snap, event)
        return next.status === 'done' ? Effect.fail(err) : retry(run, url, next)
      }),
    onSuccess: (res) => {
      const landed = responseEvent(run, res, url)
      const next = step(snap, landed.event)
      if (next.status === 'done') return settle(run, next, landed)
      if (next.context.hops > snap.context.hops)
        return Effect.andThen(dropBody(res), drive(run, landed.url, next))
      return Effect.flatMap(Clock.currentTimeMillis, (now) => {
        const waitMs = retryAfterMs(res.headers.get('retry-after'), now)
        return (waitMs ?? 0) > run.deadline - now
          ? Effect.succeed(landed)
          : Effect.andThen(dropBody(res), retry(run, url, next, waitMs))
      })
    },
  })
}

// GET with retry: network-level failures and retryable statuses retry on the
// fixed backoff (or the server's Retry-After); other statuses return as-is.
export const httpGet = (
  url: string,
  opts: FetchOptions = {},
): Effect.Effect<Response, FetchError> =>
  Effect.flatMap(startRun(url, opts), (run) =>
    Effect.map(drive(run, url, START), (landed) => landed.res),
  )

// Text GETs revalidate through the disk cache; a cache config error surfaces
// as a FetchError, so callers see only HttpStatusError or FetchError.
export const fetchText = (
  url: string,
  opts: FetchOptions = {},
): Effect.Effect<string, HttpStatusError | FetchError> =>
  cachedGetText<HttpStatusError | FetchError>(
    url,
    (h) => httpGet(url, { ...opts, headers: { ...opts.headers, ...h } }),
    (res) => okText(res, url, opts.maxBytes),
    opts,
  ).pipe(
    Effect.catchTag('ConfigError', (err) => Effect.fail(new FetchError({ message: errMsg(err) }))),
    Effect.provide(BunServices.layer),
  )

// The ROOT of a crawl/map is the user's explicit target: follow its redirects
// freely (apex→www) and report the FINAL url to re-anchor the host scope on.
export const fetchRoot = Effect.fn('fetchRoot')(function* (url: string, opts: FetchOptions = {}) {
  const res = yield* httpGet(url, opts)
  return { finalUrl: res.url || url, html: yield* okText(res, url) }
})

// Fetch text but follow redirects MANUALLY, blocking any hop that leaves `host`
// (EXACT hostname match — scope control for crawls, not an IP/SSRF filter).
export const fetchTextWithinHost = (url: string, host: string, opts: FetchOptions = {}) =>
  Effect.flatMap(startRun(url, { ...opts, redirect: 'manual' }, host), (run) =>
    Effect.flatMap(drive(run, url, START), (landed) => okText(landed.res, landed.url)),
  )
