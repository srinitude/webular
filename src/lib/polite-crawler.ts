// Polite crawler: Mercator-style frontier (crawl-frontier.ts), RFC 9309
// robots.txt, adaptive per-host delay, SimHash near-duplicate skip, and
// SQLite resume tokens that survive across processes.
import { Effect } from 'effect'
import {
  attempt,
  type CrawlError,
  enqueue,
  flush,
  makeFrontier,
  pop,
  release,
} from './crawl-frontier.ts'
import { loadRun, newRun, openDb, restore } from './crawl-resume.ts'
import {
  type CrawlOptions,
  type CrawlResult,
  extractLinks,
  type FetchResponse,
  floorOf,
  keepAll,
  nextDelay,
  ROBOTS_TTL_MS,
  type Run,
  textOf,
  titleOf,
} from './crawl-types.ts'
import { isNearDuplicate, remember } from './fingerprints.ts'
import { isAllowed, type Robots, robotsFromResponse } from './robots-txt.ts'
import { halves, simhash64 } from './simhash.ts'

export {
  type CrawledPage,
  type CrawlOptions,
  type CrawlResult,
  extractLinks,
  type Fetcher,
  type FetchResponse,
  type LinkCandidate,
  type LinkJudge,
  MAX_DELAY_MS,
  MIN_DELAY_MS,
  nextDelay,
  type SkipReason,
  textOf,
} from './crawl-types.ts'

const robotsFor = (r: Run, origin: string) => {
  const cached = r.robots.get(origin)
  if (cached && r.now() - cached.at < ROBOTS_TTL_MS) return Effect.succeed(cached.rules)
  return r.o.fetch(`${origin}/robots.txt`).pipe(
    Effect.orElseSucceed(() => null),
    Effect.flatMap((res) =>
      attempt(() => {
        const rules = robotsFromResponse(res, r.o.userAgent ?? 'webular')
        const at = r.now()
        r.robots.set(origin, { rules, at })
        r.db
          .query(
            'INSERT OR REPLACE INTO crawl_robots (token, origin, rules, at) VALUES (?, ?, ?, ?)',
          )
          .run(r.token, origin, JSON.stringify(rules), at)
        return rules
      }),
    ),
  )
}

const follow = (r: Run, url: string, body: string) => {
  const links = extractLinks(body, url).filter(
    (l) => r.o.sameOrigin === false || r.origins.has(new URL(l.url).origin),
  )
  if (links.length === 0) return Effect.void
  return (r.o.linkWorthFollowing ?? keepAll)({ url, title: titleOf(body) }, links).pipe(
    Effect.orElseSucceed(() => links.map(() => true)),
    Effect.flatMap((keep) =>
      enqueue(
        r.frontier,
        links.filter((_, i) => keep[i] !== false).map((l) => l.url),
      ),
    ),
  )
}

// True when the page holds unique content: a 2xx that is not a near-duplicate.
const keepPage = (r: Run, url: string, res: FetchResponse | null) => {
  if (!res) return void r.result.skipped.push({ url, reason: 'fetch-error' })
  const ok = res.status >= 200 && res.status < 300
  if (ok) {
    const [lo, hi] = halves(simhash64(textOf(res.body)))
    if (isNearDuplicate(r.fingerprints, lo, hi))
      return void r.result.skipped.push({ url, reason: 'near-duplicate' })
    remember(r.fingerprints, lo, hi)
    r.db
      .query('INSERT INTO crawl_fingerprints (token, lo, hi) VALUES (?, ?, ?)')
      .run(r.token, lo, hi)
  }
  r.result.pages.push({ url, status: res.status, body: res.body })
  return ok
}

const settle = (
  r: Run,
  host: string,
  res: FetchResponse | null,
  fetchMs: number,
  rules: Robots,
) => {
  const delay = nextDelay(
    r.delays.get(host) ?? floorOf(r),
    { status: res?.status ?? 0, fetchMs, crawlDelayMs: rules.crawlDelayMs },
    floorOf(r),
  )
  r.delays.set(host, delay)
  r.db
    .query('INSERT OR REPLACE INTO crawl_delays (token, host, ms) VALUES (?, ?, ?)')
    .run(r.token, host, delay)
  release(r.frontier, host, r.now() + delay)
}

const visit = (r: Run, url: string, host: string) => {
  const target = new URL(url)
  return Effect.flatMap(robotsFor(r, target.origin), (rules) => {
    if (!isAllowed(rules, target.pathname + target.search)) {
      r.result.skipped.push({ url, reason: 'robots' })
      release(r.frontier, host, r.now())
      return Effect.void
    }
    const start = r.now()
    return r.o.fetch(url).pipe(
      Effect.orElseSucceed(() => null),
      Effect.flatMap((res) =>
        attempt(() => {
          settle(r, host, res, r.now() - start, rules)
          return keepPage(r, url, res)
        }).pipe(Effect.flatMap((keep) => (keep && res ? follow(r, url, res.body) : Effect.void))),
      ),
    )
  })
}

const worker = (r: Run, maxPages: number): Effect.Effect<void, CrawlError> =>
  Effect.flatMap(r.visits >= maxPages ? Effect.succeed(null) : pop(r.frontier, r.now()), (next) => {
    const again = () => worker(r, maxPages)
    if (next === null)
      return r.inFlight === 0 || r.visits >= maxPages
        ? Effect.void
        : Effect.flatMap(r.sleep(floorOf(r) / 5), again)
    if ('waitMs' in next) return Effect.flatMap(r.sleep(next.waitMs), again)
    r.visits++
    r.inFlight++
    return visit(r, next.url, next.host).pipe(
      Effect.ensuring(Effect.sync(() => r.inFlight--)),
      Effect.flatMap(again),
    )
  })

/** Crawls politely from `seeds`, or continues the crawl named by `resume`. */
export const crawl = (o: CrawlOptions): Effect.Effect<CrawlResult, CrawlError> =>
  Effect.scoped(
    Effect.gen(function* () {
      const clock = yield* Effect.clockWith(Effect.succeed)
      const db = yield* openDb(o.dbPath)
      const { token, origins } = yield* loadRun(db, o)
      const frontier = makeFrontier(db, token, o.memoryCap ?? 1000)
      if (o.resume === undefined) yield* enqueue(frontier, o.seeds ?? [])
      const run = newRun(o, db, frontier, origins, token, () => clock.currentTimeMillisUnsafe())
      if (o.resume !== undefined) yield* restore(run)
      const n = Math.max(1, o.concurrency ?? 4)
      yield* Effect.forEach(Array.from({ length: n }), () => worker(run, o.maxPages ?? 100), {
        concurrency: n,
        discard: true,
      })
      yield* flush(frontier)
      return { ...run.result, done: frontier.spilled === 0 }
    }),
  )
