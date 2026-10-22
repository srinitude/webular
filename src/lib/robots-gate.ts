// The one robots.txt gate for one-off fetches (scrape, batch through scrape,
// map's root page): one robots.txt read per origin, cached for ROBOTS_TTL_MS,
// read under the RFC 9309 status rules in robotsFromResponse. A disallowed
// path fails with a `blocked` FetchError whose reason is `robots`, before any
// GET of the page, so no browser or archive fallback ever sees it. A host that
// gives no HTTP answer at all fails with that fetch error itself,
// uncached: RFC 9309 assumes disallow only on a 5xx answer.
import { Cache, Context, Effect, Exit, Layer } from 'effect'
import { FetchError as HopError, type FetchError as HttpFetchError } from '../core/decode.ts'
import { type FetchOptions, fetchText, httpGet } from '../core/http.ts'
import { dropBody, okText } from '../core/http-body.ts'
import { ROBOTS_TTL_MS } from './crawl-types.ts'
import { FetchError, fail } from './fetch-types.ts'
import { MAX_ROBOTS_BYTES, matchedRule, type Robots, robotsFromResponse } from './robots-txt.ts'

/** The product token that robots.txt user-agent groups match. */
export const ROBOTS_AGENT = 'webular'
const ORIGINS_CACHED = 256
// Each robots.txt attempt's timeout, so an unreachable host fails in seconds, not 30.
const ROBOTS_TIMEOUT_MS = 5_000

// ponytail: a robots.txt over MAX_ROBOTS_BYTES or with a non-text type fails the
// read and so disallows all; truncate instead if a real site trips it. Map reads
// robots.txt a second time for its Sitemap: lines; keep them in Robots to share one read.
const readRobots = (origin: string) => {
  const url = `${origin}/robots.txt`
  return Effect.flatMap(httpGet(url, { timeoutMs: ROBOTS_TIMEOUT_MS }), (res) =>
    (res.ok
      ? Effect.map(okText(res, origin, MAX_ROBOTS_BYTES), (body) => ({ status: res.status, body }))
      : Effect.as(dropBody(res), { status: res.status, body: '' })
    ).pipe(Effect.orElseSucceed(() => null)),
  )
}

export class RobotsGate extends Context.Service<
  RobotsGate,
  { readonly robots: (origin: string) => Effect.Effect<Robots, HttpFetchError> }
>()('webular/lib/RobotsGate') {
  static readonly layer = Layer.effect(
    RobotsGate,
    Effect.map(
      Cache.makeWith(
        (origin: string) =>
          Effect.map(readRobots(origin), (r) => robotsFromResponse(r, ROBOTS_AGENT)),
        {
          capacity: ORIGINS_CACHED,
          timeToLive: (exit) => (Exit.isSuccess(exit) ? ROBOTS_TTL_MS : 0),
        },
      ),
      (cache) => ({ robots: (origin: string) => Cache.get(cache, origin) }),
    ),
  )
}

/** Succeeds when robots.txt allows `url`; fails `blocked`/`robots` with the matched rule. */
export const robotsGate = Effect.fn('robotsGate')(function* (url: string) {
  const target = new URL(url)
  const robots = yield* RobotsGate.use((gate) => gate.robots(target.origin))
  const rule = matchedRule(robots, target.pathname + target.search)
  if (rule && !rule.allow)
    return yield* fail(url, 'blocked', 'give-up', { reason: 'robots', rule: rule.pattern })
})

export const isRobotsBlock = (err: unknown): err is FetchError =>
  err instanceof FetchError && err.reason === 'robots'

/** A robotsGate failure as one line: the disallow rule, or the fetch error of a host that gave no answer. */
export const refusalText = (err: FetchError | HttpFetchError): string =>
  isRobotsBlock(err) ? `blocked: robots.txt disallows ${err.rule ?? '/'}` : err.message

/** The robots check as a FetchOptions.hopGate: one call per url, the first and each redirect hop. */
export const robotsHopGate = RobotsGate.use((gate) =>
  Effect.succeed((u: string) =>
    robotsGate(u).pipe(
      Effect.provideService(RobotsGate, gate),
      // A host with no robots.txt answer fails with its own fetch error, unwrapped.
      Effect.mapError((err) =>
        isRobotsBlock(err)
          ? new HopError({
              message: `blocked: robots.txt disallows ${err.rule} (${u})`,
              cause: err,
            })
          : err,
      ),
    ),
  ),
)

/** fetchText for commands that always obey robots.txt: the url and every redirect hop are gated. */
export const fetchTextObeyingRobots = (url: string, opts: FetchOptions = {}) =>
  Effect.flatMap(robotsHopGate, (allow) =>
    Effect.andThen(allow(url), fetchText(url, { ...opts, hopGate: allow })),
  )

/** A redirect hop's robots block, back as the robots FetchError it wraps. */
export const hopBlockToRobots = <E>(err: E): E | FetchError =>
  err instanceof HopError && isRobotsBlock(err.cause) ? err.cause : err
