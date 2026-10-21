// Crawl command core. The root is fetched first (redirects followed, scope
// re-anchored on the final host), then the polite crawler (Mercator frontier,
// RFC 9309 robots, adaptive per-host delay) runs over the fetch layer. The
// crawl stays on one host and the frontier keeps one fetch in flight per
// host, so its FIFO order is BFS order and the output is deterministic.
// Every 2xx page also lands in the local index, which search fuses with web hits.
import { Data, Effect } from 'effect'
import { fetchRoot } from '../core/http.ts'
import { errMsg } from '../core/output.ts'
import { normalizeUrl, sameHost } from '../core/url.ts'
import { archivedUrls } from './archive-urls.ts'
import { headingText } from './crawl-types.ts'
import { type FetchError, type FetchPage, makeFetchLayer } from './fetch-layer.ts'
import { titleAndLinks } from './html.ts'
import { Jev } from './jev/client.ts'
import { decisions } from './jev/decisions.ts'
import { onJevRuntime } from './jev/run.ts'
import { addPages, openLocalIndex } from './local-index.ts'
import { localIndexPath } from './local-index-path.ts'
import {
  type CrawlResult as CrawlRun,
  crawl,
  extractLinks,
  type Fetcher,
  type LinkCandidate,
  type LinkJudge,
} from './polite-crawler.ts'

interface PageInfo {
  url: string
  title: string
}

interface FetchErrorInfo {
  url: string
  reason: string
}

interface CrawlOptions {
  limit: number
  depth: number
  concurrency: number
  timeoutMs?: number | undefined
  /** Per-host delay floor for the polite crawler; lower it only for local test servers. */
  minDelayMs?: number | undefined
  /** Jev's linkWorthFollowing with the goal bound in; asked once per new same-host link. */
  linkWorthFollowing?: LinkJudge | undefined
}

class CrawlError extends Data.TaggedError('CrawlError')<{ readonly message: string }> {}

type RootOutcome = { ok: true; finalUrl: string; html: string } | { ok: false; reason: string }

// The root is the user's explicit target — its redirects are followed freely
// and the crawl scope re-anchors on the FINAL host (apex→www).
const fetchRootPage = (url: string, timeoutMs?: number) =>
  fetchRoot(url, { timeoutMs }).pipe(
    Effect.match({
      onSuccess: ({ finalUrl, html }): RootOutcome => ({ ok: true, finalUrl, html }),
      onFailure: (err): RootOutcome => ({ ok: false, reason: errMsg(err) }),
    }),
  )

interface Scope {
  readonly host: string
  readonly maxDepth: number
  /** URL -> depth for every link seen; the first (shallowest) discoverer wins. O(links seen). */
  readonly depths: Map<string, number>
  readonly judge?: LinkJudge | undefined
}

// The ONLY dedup/scope point, run as the polite crawler's LinkJudge hook: new
// same-host links within depth pass the optional Jev judge; rejected links stay
// seen so no later page asks about them again.
const harvest =
  (s: Scope): LinkJudge =>
  (page, links) => {
    const depth = s.depths.get(page.url) ?? s.maxDepth
    const fresh: LinkCandidate[] = []
    for (const l of links) {
      if (depth >= s.maxDepth || s.depths.has(l.url) || !sameHost(s.host, l.url)) continue
      s.depths.set(l.url, depth + 1)
      fresh.push(l)
    }
    const verdicts = s.judge ? s.judge(page, fresh) : Effect.succeed(fresh.map(() => true))
    return Effect.map(verdicts, (keep) => {
      const kept = new Set(fresh.filter((_, i) => keep[i] !== false).map((l) => l.url))
      return links.map((l) => kept.delete(l.url))
    })
  }

const reasonOf = (e: FetchError) => (e.status ? `HTTP ${e.status}` : `${e.kind} error`)

// Fetch failures come back as status responses: a robots.txt 4xx means allow-all, status 0 (no response) disallow-all.
const asFetcher =
  (fetchPage: FetchPage, reasons: Map<string, string>): Fetcher =>
  (url) =>
    fetchPage(url).pipe(
      Effect.map(({ status, body, headers }) => ({ status, body, headers })),
      Effect.catchTag('FetchError', (e) => {
        reasons.set(url, reasonOf(e))
        return Effect.succeed({ status: e.status ?? 0, body: '', headers: {} })
      }),
    )

// One pass: 2xx pages become results, the rest become errors, then robots skips.
const toResult = (
  root: PageInfo,
  run: Pick<CrawlRun, 'pages' | 'skipped'>,
  reasons: ReadonlyMap<string, string>,
) => {
  const pages: PageInfo[] = [root]
  const errors: FetchErrorInfo[] = []
  for (const p of run.pages)
    if (p.status >= 200 && p.status < 300)
      pages.push({ url: p.url, title: titleAndLinks(p.body, p.url, false).title })
    else errors.push({ url: p.url, reason: reasons.get(p.url) ?? `HTTP ${p.status}` })
  for (const s of run.skipped) errors.push({ url: s.url, reason: `skipped: ${s.reason}` })
  return { root: root.url, pages, errors }
}

// ponytail: page bodies stay in memory until this one batch insert, O(limit x page size);
// stream pages into the index from the crawler if limits grow past 1000.
const indexPages = (pages: ReadonlyArray<PageInfo>, bodies: Map<string, string>) =>
  Effect.gen(function* () {
    const index = yield* openLocalIndex(yield* localIndexPath)
    const indexed = pages.map((p) => ({ ...p, text: headingText(bodies.get(p.url) ?? '') }))
    yield* addPages(index, indexed)
  })

const crawlSeeds = (fetch: Fetcher, seeds: string[], judge: LinkJudge, opts: CrawlOptions) =>
  seeds.length > 0 && opts.limit > 1
    ? crawl({
        fetch,
        seeds,
        dbPath: ':memory:',
        concurrency: opts.concurrency,
        minDelayMs: opts.minDelayMs,
        maxPages: opts.limit - 1,
        linkWorthFollowing: judge,
      })
    : Effect.succeed({ pages: [], skipped: [] })

// Jev's map.kind order (main first, junk last, stable). With Jev off or no key the
// incoming order stands: the kind baseline's junk rule must not reorder that path.
type OrderInput = Parameters<typeof decisions.mapOrder>[0]
export const jevOrder = Object.assign(
  Effect.fnUntraced(function* (input: OrderInput) {
    const jev = yield* Jev
    return jev.available ? yield* decisions.mapOrder(input) : [...input.urls]
  }),
  { def: decisions.mapOrder.def },
)

// When the page limit cuts the root's links, the best ones become the first seeds.
// ponytail: only the root's links are ranked; deeper links keep frontier (BFS) order.
const orderSeeds = (site: string, urls: string[], room: number) =>
  room > 0 && urls.length > room ? onJevRuntime(jevOrder, { site, urls }) : Effect.succeed(urls)

const crawlFrom = (rootUrl: string, finalUrl: string, html: string, opts: CrawlOptions) =>
  Effect.gen(function* () {
    const anchored = normalizeUrl(finalUrl) ?? rootUrl
    const root = { url: anchored, title: titleAndLinks(html, anchored, false).title }
    const depths = new Map([
      [rootUrl, 0],
      [anchored, 0],
    ])
    const scope = { host: new URL(anchored).hostname, maxDepth: opts.depth, depths }
    const judge = harvest({ ...scope, judge: opts.linkWorthFollowing })
    const links = extractLinks(html, anchored)
    const keep = yield* judge(root, links)
    const kept = links.filter((_, i) => keep[i]).map((l) => l.url)
    const seeds = yield* orderSeeds(anchored, kept, opts.limit - 1)
    const reasons = new Map<string, string>()
    const fetch = asFetcher(yield* makeFetchLayer({ deadlineMs: opts.timeoutMs }), reasons)
    const run = yield* crawlSeeds(fetch, seeds, judge, opts)
    const result = toResult(root, run, reasons)
    yield* indexPages(
      result.pages,
      new Map([[anchored, html], ...run.pages.map((p) => [p.url, p.body] as const)]),
    )
    return result
  })

// The root would not answer: Common Crawl's index and the Wayback CDX list
// what they held for the site (2603.01548). Titles are unknown without a fetch; the error stays when
// the index has nothing.
const archivedCrawl = (rootUrl: string, limit: number, reason: string) =>
  Effect.map(archivedUrls('crawl', rootUrl, limit), (urls) => {
    const pages = urls.map((url) => ({ url, title: '' }))
    return { root: rootUrl, pages, errors: pages.length ? [] : [{ url: rootUrl, reason }] }
  })
export const bfsCrawl = Effect.fn('bfsCrawl')(function* (root: string, opts: CrawlOptions) {
  const rootUrl = normalizeUrl(root)
  if (!rootUrl) return yield* new CrawlError({ message: `crawl: invalid URL ${root}` })
  const entry = yield* fetchRootPage(rootUrl, opts.timeoutMs)
  if (!entry.ok) return yield* archivedCrawl(rootUrl, opts.limit, entry.reason)
  return yield* Effect.scoped(crawlFrom(rootUrl, entry.finalUrl, entry.html, opts))
})
