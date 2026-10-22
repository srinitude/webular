// The one robots.txt gate for one-off fetches (scrape, batch through scrape,
// map's root page): one robots.txt read per origin, cached for ROBOTS_TTL_MS,
// read under the RFC 9309 status rules in robotsFromResponse. A disallowed
// path fails with a `blocked` FetchError whose reason is `robots`, before any
// GET of the page, so no browser or archive fallback ever sees it.
import { Cache, Context, Effect, Layer } from 'effect'
import { httpGet } from '../core/http.ts'
import { dropBody, okText } from '../core/http-body.ts'
import { ROBOTS_TTL_MS } from './crawl-types.ts'
import { FetchError, fail } from './fetch-types.ts'
import { MAX_ROBOTS_BYTES, matchedRule, type Robots, robotsFromResponse } from './robots-txt.ts'

/** The product token that robots.txt user-agent groups match. */
export const ROBOTS_AGENT = 'webular'
const ORIGINS_CACHED = 256

// ponytail: a robots.txt over MAX_ROBOTS_BYTES or with a non-text type fails the
// read and so disallows all; truncate instead if a real site trips it. Map reads
// robots.txt a second time for its Sitemap: lines; keep them in Robots to share one read.
const readRobots = (origin: string) =>
  Effect.flatMap(httpGet(`${origin}/robots.txt`), (res) =>
    res.ok
      ? Effect.map(okText(res, origin, MAX_ROBOTS_BYTES), (body) => ({ status: res.status, body }))
      : Effect.as(dropBody(res), { status: res.status, body: '' }),
  ).pipe(Effect.orElseSucceed(() => null))

export class RobotsGate extends Context.Service<
  RobotsGate,
  { readonly robots: (origin: string) => Effect.Effect<Robots> }
>()('webular/lib/RobotsGate') {
  static readonly layer = Layer.effect(
    RobotsGate,
    Effect.map(
      Cache.make({
        capacity: ORIGINS_CACHED,
        timeToLive: ROBOTS_TTL_MS,
        lookup: (origin: string) =>
          Effect.map(readRobots(origin), (r) => robotsFromResponse(r, ROBOTS_AGENT)),
      }),
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
