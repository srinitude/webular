// BFS crawler: same-host, deduped, bounded by limit and depth (FOSS: p-limit).
import pLimit from 'p-limit'
import { fetchText } from '../core/http.ts'
import { extractLinks, htmlToArticle } from './html.ts'

export interface PageInfo {
  url: string
  title: string
}

export interface CrawlOptions {
  limit: number
  depth: number
  concurrency: number
}

interface QueueItem {
  url: string
  d: number
}

interface CrawlCtx {
  root: string
  depth: number
  seen: Set<string>
  queue: QueueItem[]
  results: PageInfo[]
}

function sameHost(base: string, candidate: string): boolean {
  try {
    return new URL(candidate).hostname === new URL(base).hostname
  } catch {
    return false
  }
}

function enqueue(html: string, item: QueueItem, ctx: CrawlCtx): void {
  for (const link of extractLinks(html, item.url)) {
    if (ctx.seen.has(link) || !sameHost(ctx.root, link)) continue
    ctx.seen.add(link)
    ctx.queue.push({ url: link, d: item.d + 1 })
  }
}

async function crawlOne(item: QueueItem, ctx: CrawlCtx): Promise<void> {
  try {
    const html = await fetchText(item.url)
    ctx.results.push({ url: item.url, title: htmlToArticle(html).title })
    if (item.d < ctx.depth) enqueue(html, item, ctx)
  } catch {
    /* skip unreachable pages */
  }
}

export async function bfsCrawl(root: string, opts: CrawlOptions): Promise<PageInfo[]> {
  const ctx: CrawlCtx = {
    root,
    depth: opts.depth,
    seen: new Set([root]),
    queue: [{ url: root, d: 0 }],
    results: [],
  }
  const pool = pLimit(opts.concurrency)
  while (ctx.queue.length > 0 && ctx.results.length < opts.limit) {
    const batch = ctx.queue.splice(0, opts.limit - ctx.results.length)
    await Promise.all(batch.map((item) => pool(() => crawlOne(item, ctx))))
  }
  return ctx.results.slice(0, opts.limit)
}
