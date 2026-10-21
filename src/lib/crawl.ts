// Deterministic BFS crawler. Shared state mutates ONLY in sequential,
// index-ordered folds that run after each batch fully settles — concurrency
// (Effect.forEach, results in input order) affects when fetches run, never
// which pages are emitted or in what order. One linkedom parse per page;
// dedup on normalized URLs; exact-host scope.
import { Data, Effect } from 'effect'
import { fetchRoot, fetchTextWithinHost } from '../core/http.ts'
import { errMsg } from '../core/output.ts'
import { normalizeUrl, sameHost } from '../core/url.ts'
import { titleAndLinks } from './html.ts'

interface PageInfo {
  url: string
  title: string
}

interface FetchError {
  url: string
  reason: string
}

interface CrawlOptions {
  limit: number
  depth: number
  concurrency: number
  timeoutMs?: number | undefined
}

type FetchOutcome =
  | { url: string; ok: true; title: string; links: string[] }
  | { url: string; ok: false; reason: string }

interface CrawlCtx {
  host: string
  limit: number
  maxDepth: number
  concurrency: number
  timeoutMs?: number | undefined
  seen: Set<string>
  pages: PageInfo[]
  errors: FetchError[]
}

class CrawlError extends Data.TaggedError('CrawlError')<{ readonly message: string }> {}

// withLinks is false on the last level: those links are never enqueued.
function fetchPage(url: string, ctx: CrawlCtx, withLinks: boolean): Effect.Effect<FetchOutcome> {
  return fetchTextWithinHost(url, ctx.host, { timeoutMs: ctx.timeoutMs }).pipe(
    Effect.map((html): FetchOutcome => ({ url, ok: true, ...titleAndLinks(html, url, withLinks) })),
    Effect.catch((err) => Effect.succeed<FetchOutcome>({ url, ok: false, reason: errMsg(err) })),
  )
}

type RootOutcome =
  | { ok: true; finalUrl: string; title: string; links: string[] }
  | { ok: false; reason: string }

// The root is the user's explicit target — its redirects are followed freely
// and the crawl scope re-anchors on the FINAL host (apex→www).
function fetchRootPage(
  url: string,
  withLinks: boolean,
  timeoutMs?: number,
): Effect.Effect<RootOutcome> {
  return fetchRoot(url, { timeoutMs }).pipe(
    Effect.map(
      ({ finalUrl, html }): RootOutcome => ({
        ok: true,
        finalUrl,
        ...titleAndLinks(html, finalUrl, withLinks),
      }),
    ),
    Effect.catch((err) => Effect.succeed<RootOutcome>({ ok: false, reason: errMsg(err) })),
  )
}

// The ONLY dedup/enqueue point — sequential, in document order, so the first
// discoverer wins deterministically.
function harvest(links: string[], base: string, ctx: CrawlCtx, next: string[]): void {
  for (const link of links) {
    const normalized = normalizeUrl(link, base)
    if (!normalized || ctx.seen.has(normalized) || !sameHost(ctx.host, normalized)) continue
    ctx.seen.add(normalized)
    next.push(normalized)
  }
}

function fold(outcomes: FetchOutcome[], mayEnqueue: boolean, ctx: CrawlCtx, next: string[]): void {
  for (const outcome of outcomes) {
    if (!outcome.ok) {
      ctx.errors.push({ url: outcome.url, reason: outcome.reason })
      continue
    }
    ctx.pages.push({ url: outcome.url, title: outcome.title })
    if (mayEnqueue) harvest(outcome.links, outcome.url, ctx, next)
  }
}

// Failures under-fill a batch, so the while-loop refills from the SAME level
// before descending; the limit cut always slices an already-ordered array.
const crawlLevel = Effect.fnUntraced(function* (level: string[], depth: number, ctx: CrawlCtx) {
  const next: string[] = []
  let cursor = 0
  while (cursor < level.length && ctx.pages.length < ctx.limit) {
    const take = level.slice(cursor, cursor + (ctx.limit - ctx.pages.length))
    cursor += take.length
    const mayEnqueue = depth < ctx.maxDepth
    const outcomes = yield* Effect.forEach(take, (url) => fetchPage(url, ctx, mayEnqueue), {
      concurrency: ctx.concurrency,
    })
    fold(outcomes, mayEnqueue, ctx, next)
  }
  return next
})

export const bfsCrawl = Effect.fn('bfsCrawl')(function* (root: string, opts: CrawlOptions) {
  const rootUrl = normalizeUrl(root)
  if (!rootUrl) return yield* Effect.fail(new CrawlError({ message: `crawl: invalid URL ${root}` }))
  const entry = yield* fetchRootPage(rootUrl, opts.depth > 0, opts.timeoutMs)
  if (!entry.ok)
    return { root: rootUrl, pages: [], errors: [{ url: rootUrl, reason: entry.reason }] }
  const anchored = normalizeUrl(entry.finalUrl) ?? rootUrl
  const ctx: CrawlCtx = {
    host: new URL(anchored).hostname,
    limit: opts.limit,
    maxDepth: opts.depth,
    concurrency: opts.concurrency,
    timeoutMs: opts.timeoutMs,
    seen: new Set([rootUrl, anchored]),
    pages: [{ url: anchored, title: entry.title }],
    errors: [],
  }
  let level: string[] = []
  if (ctx.maxDepth > 0) harvest(entry.links, anchored, ctx, level)
  for (let d = 1; d <= opts.depth && level.length > 0 && ctx.pages.length < ctx.limit; d++) {
    level = yield* crawlLevel(level, d, ctx)
  }
  return { root: anchored, pages: ctx.pages, errors: ctx.errors }
})
