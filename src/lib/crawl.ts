// Deterministic BFS crawler. Shared state mutates ONLY in sequential,
// index-ordered folds that run after each batch fully settles — concurrency
// (p-limit, FIFO starts; Promise.all index collection) affects when fetches
// run, never which pages are emitted or in what order. One linkedom parse per
// page (parsePage); dedup on normalized URLs; exact-host scope.
import pLimit from 'p-limit'
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

interface CrawlResult {
  root: string
  pages: PageInfo[]
  errors: FetchError[]
}

interface CrawlOptions {
  limit: number
  depth: number
  concurrency: number
  timeoutMs?: number
}

type FetchOutcome =
  | { url: string; ok: true; title: string; links: string[] }
  | { url: string; ok: false; reason: string }

interface CrawlCtx {
  host: string
  limit: number
  maxDepth: number
  timeoutMs?: number
  pool: ReturnType<typeof pLimit>
  seen: Set<string>
  pages: PageInfo[]
  errors: FetchError[]
}

async function fetchPage(url: string, ctx: CrawlCtx): Promise<FetchOutcome> {
  try {
    const html = await fetchTextWithinHost(url, ctx.host, { timeoutMs: ctx.timeoutMs })
    const page = titleAndLinks(html, url)
    return { url, ok: true, title: page.title, links: page.links }
  } catch (err) {
    return { url, ok: false, reason: errMsg(err) }
  }
}

type RootOutcome =
  | { ok: true; finalUrl: string; title: string; links: string[] }
  | { ok: false; reason: string }

// The root is the user's explicit target — its redirects are followed freely
// and the crawl scope re-anchors on the FINAL host (apex→www).
async function fetchRootPage(url: string, timeoutMs?: number): Promise<RootOutcome> {
  try {
    const { finalUrl, html } = await fetchRoot(url, { timeoutMs })
    const page = titleAndLinks(html, finalUrl)
    return { ok: true, finalUrl, title: page.title, links: page.links }
  } catch (err) {
    return { ok: false, reason: errMsg(err) }
  }
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
async function crawlLevel(level: string[], depth: number, ctx: CrawlCtx): Promise<string[]> {
  const next: string[] = []
  let cursor = 0
  while (cursor < level.length && ctx.pages.length < ctx.limit) {
    const take = level.slice(cursor, cursor + (ctx.limit - ctx.pages.length))
    cursor += take.length
    const outcomes = await Promise.all(take.map((url) => ctx.pool(() => fetchPage(url, ctx))))
    fold(outcomes, depth < ctx.maxDepth, ctx, next)
  }
  return next
}

export async function bfsCrawl(root: string, opts: CrawlOptions): Promise<CrawlResult> {
  const rootUrl = normalizeUrl(root)
  if (!rootUrl) throw new Error(`crawl: invalid URL ${root}`)
  const entry = await fetchRootPage(rootUrl, opts.timeoutMs)
  if (!entry.ok)
    return { root: rootUrl, pages: [], errors: [{ url: rootUrl, reason: entry.reason }] }
  const anchored = normalizeUrl(entry.finalUrl) ?? rootUrl
  const ctx: CrawlCtx = {
    host: new URL(anchored).hostname,
    limit: opts.limit,
    maxDepth: opts.depth,
    timeoutMs: opts.timeoutMs,
    pool: pLimit(opts.concurrency),
    seen: new Set([rootUrl, anchored]),
    pages: [{ url: anchored, title: entry.title }],
    errors: [],
  }
  let level: string[] = []
  if (ctx.maxDepth > 0) harvest(entry.links, anchored, ctx, level)
  for (let d = 1; d <= opts.depth && level.length > 0 && ctx.pages.length < ctx.limit; d++) {
    level = await crawlLevel(level, d, ctx)
  }
  return { root: anchored, pages: ctx.pages, errors: ctx.errors }
}
