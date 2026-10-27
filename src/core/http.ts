// HttpClient layer: guarded redirects, textual-content guard, bounded retry, disk-cache
// revalidation. The fetch machine (src/machines/fetch.ts) decides every retry, redirect,
// and failure; this file only performs the requests it asks for, one attempt at a time
// through http-send.ts (timeout, user-agent).
import { BunServices } from '@effect/platform-bun'
import { Clock, Effect } from 'effect'
import { type EventFromLogic, initialTransition, type SnapshotFrom, transition } from 'xstate'
import { failureEvent, fetchMachine } from '../machines/fetch.ts'
import { guardTarget } from './address-guard.ts'
import { hop } from './auth-headers.ts'
import { cachedGetText } from './cache.ts'
import { FetchError } from './decode.ts'
import {
  countRequest,
  FETCH_ERROR,
  noteAttempt,
  RETRY_BACKOFF_MS,
  RETRY_STATUS,
  retryPause,
  takeRetry,
} from './fetch-policy.ts'
import { dropBody, type HttpStatusError, okText } from './http-body.ts'
import { type FetchOptions, fetchOnce } from './http-send.ts'
import { errMsg } from './output.ts'
import { retryAfterMs, retryAfterOverCap } from './retry-after.ts'
import { sameHost } from './url.ts'

export { type FetchOptions, USER_AGENT } from './http-send.ts'

type FetchSnapshot = SnapshotFrom<typeof fetchMachine>
type FetchEvent = EventFromLogic<typeof fetchMachine>

const [START] = initialTransition(fetchMachine)
const step = (snap: FetchSnapshot, event: FetchEvent) => transition(fetchMachine, snap, event)[0]

const isRedirect = (status: number) => status >= 300 && status < 400

// One run: `byHand` follows redirects here, guarded; `host` scopes hops; `deadline` caps retries.
interface Run {
  origin: string
  originPrivate: boolean
  byHand: boolean
  host?: string | undefined
  opts: FetchOptions
  deadline: number
}

const startRun = (origin: string, opts: FetchOptions, host?: string) =>
  Effect.zipWith(guardTarget(origin), Clock.currentTimeMillis, (originPrivate, now): Run => {
    const deadline = now + (opts.timeoutMs ?? Number.POSITIVE_INFINITY)
    const byHand = host !== undefined || opts.redirect !== 'manual'
    return { origin, originPrivate, byHand, host, opts, deadline }
  }).pipe(Effect.tap(countRequest(origin)))

type Landed = { res: Response; url: string }

// Names a response as a machine event, with the url the next step uses.
function responseEvent(run: Run, res: Response, url: string): Landed & { event: FetchEvent } {
  const settled = { res, url, event: { type: res.ok ? 'OK' : 'HTTP_ERROR' } } as const
  if (RETRY_STATUS.has(res.status)) return { res, url, event: { type: 'RETRYABLE_STATUS' } }
  if (!run.byHand || !isRedirect(res.status)) return settled
  const location = res.headers.get('location')
  if (!location || !URL.canParse(location, url)) return settled
  const next = new URL(location, url).toString()
  const onHost = run.host === undefined || sameHost(run.host, next)
  const type = onHost ? 'REDIRECT_SAME_HOST' : 'REDIRECT_OFF_HOST'
  return { res, url: next, event: { type } }
}

const retry = (run: Run, url: string, snap: FetchSnapshot, waitMs?: number) =>
  (waitMs === undefined
    ? retryPause(RETRY_BACKOFF_MS[snap.context.attempt - 1] ?? 750)
    : Effect.sleep(waitMs)
  ).pipe(Effect.andThen(Effect.suspend(() => drive(run, url, snap))))

// A rejected redirect's body is never read; free its connection.
function settle(run: Run, snap: FetchSnapshot, landed: Landed): Effect.Effect<Landed, FetchError> {
  const blocked = snap.matches('offHostBlocked')
  if (!blocked && !snap.matches('tooManyRedirects')) return Effect.succeed(landed)
  const message = blocked
    ? FETCH_ERROR.offHostBlocked(landed.url)
    : FETCH_ERROR.tooManyRedirects(run.origin)
  return Effect.andThen(dropBody(landed.res), Effect.fail(new FetchError({ message })))
}

// A failed attempt retries when the machine and the host's retry budget both allow it.
function failed(run: Run, url: string, snap: FetchSnapshot, err: FetchError) {
  return Effect.flatMap(failureEvent(snap, err.aborted === true), (event) => {
    const next = step(snap, event)
    if (next.status === 'done') return Effect.fail(err)
    return Effect.flatMap(takeRetry(url), (ok) => (ok ? retry(run, url, next) : Effect.fail(err)))
  })
}

// A retried status waits its Retry-After: past the deadline, or over the host's retry budget
// or breaker, it hands back the status; over the Retry-After cap it fails.
function retryStatus(run: Run, url: string, next: FetchSnapshot, landed: Landed) {
  return Effect.flatMap(Clock.currentTimeMillis, (now) => {
    const waitMs = retryAfterMs(landed.res.headers.get('retry-after'), now)
    if ((waitMs ?? 0) > run.deadline - now) return Effect.succeed(landed)
    const over = retryAfterOverCap(waitMs)
    if (over)
      return Effect.andThen(dropBody(landed.res), Effect.fail(new FetchError({ message: over })))
    return Effect.flatMap(takeRetry(url), (ok) =>
      ok
        ? Effect.andThen(dropBody(landed.res), retry(run, url, next, waitMs))
        : Effect.succeed(landed),
    )
  })
}

// Fetch, name the outcome as an event, and do what the machine's next state says.
// Every attempt feeds the host's breaker; every retry spends the host's retry budget.
function drive(run: Run, url: string, snap: FetchSnapshot): Effect.Effect<Landed, FetchError> {
  const attempt = fetchOnce(url, run.opts).pipe(
    Effect.tap((res) => noteAttempt(url, RETRY_STATUS.has(res.status))),
    Effect.tapError(() => noteAttempt(url, true)),
  )
  return Effect.matchEffect(attempt, {
    onFailure: (err) => failed(run, url, snap, err),
    onSuccess: (res) => {
      const landed = responseEvent(run, res, url)
      const next = step(snap, landed.event)
      if (next.status === 'done') return settle(run, next, landed)
      if (next.context.hops <= snap.context.hops) return retryStatus(run, url, next, landed)
      return dropBody(res).pipe(
        Effect.andThen(guardTarget(landed.url, { url, originPrivate: run.originPrivate })),
        Effect.andThen(run.opts.hopGate?.(landed.url) ?? Effect.void),
        Effect.andThen(drive(hop(run, url, landed.url), landed.url, next)),
      )
    },
  })
}

// GET: failures and retryable statuses retry. Redirect 'manual' returns the 3xx: no hop, no gate owed.
export const httpGet = (
  url: string,
  opts: FetchOptions = {},
): Effect.Effect<Response, FetchError> =>
  Effect.flatMap(startRun(url, opts), (run) => Effect.map(drive(run, url, START), (l) => l.res))

// Text GETs revalidate through the disk cache; callers see only HttpStatusError or FetchError.
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
// and report the FINAL url to re-anchor the host scope on. The final host must
// be the same site (equal once a leading `www.` is dropped), so a root redirect
// never moves the scope to another host.
// ponytail: `www.` stripping, not a public-suffix list; add one if sites need sibling subdomains.
const site = (u: string) => (URL.parse(u)?.hostname ?? '').replace(/^www\./, '')
export const fetchRoot = Effect.fn('fetchRoot')(function* (url: string, opts: FetchOptions = {}) {
  const res = yield* httpGet(url, opts)
  const finalUrl = res.url || url
  if (site(finalUrl) !== site(url)) {
    yield* dropBody(res)
    return yield* Effect.fail(new FetchError({ message: FETCH_ERROR.offHostBlocked(finalUrl) }))
  }
  return { finalUrl, html: yield* okText(res, url) }
})

// Fetch text, following redirects MANUALLY and blocking any hop off `host` (exact match, not an SSRF filter).
export const fetchTextWithinHost = (url: string, host: string, opts: FetchOptions = {}) =>
  Effect.flatMap(startRun(url, opts, host), (run) =>
    Effect.flatMap(drive(run, url, START), (l) => okText(l.res, l.url, opts.maxBytes, opts.gunzip)),
  )
