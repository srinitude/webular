// Crawl types, link extraction, and the adaptive per-host delay.
import type { Database } from 'bun:sqlite'
import { Effect } from 'effect'
import type { Frontier } from './crawl-frontier.ts'
import type { Fingerprints } from './fingerprints.ts'
import type { Robots } from './robots-txt.ts'

export const MIN_DELAY_MS = 250
export const MAX_DELAY_MS = 2500
/** max(Crawl-delay, Retry-After, 10x fetch time); doubles on 429/5xx/no response, eases 25% on success; clamped. */
export const nextDelay = (
  previousMs: number,
  r: { status: number; fetchMs: number; crawlDelayMs: number; retryAfterMs?: number | undefined },
  floorMs = MIN_DELAY_MS,
): number => {
  const failing = r.status === 429 || r.status >= 500 || r.status === 0
  const eased = failing ? previousMs * 2 : previousMs * 0.75
  const d = Math.max(r.crawlDelayMs, r.retryAfterMs ?? 0, 10 * r.fetchMs, eased)
  return Math.min(MAX_DELAY_MS, Math.max(floorMs, d))
}

export interface LinkCandidate {
  readonly url: string
  readonly anchor: string
}
// ponytail: regex href scan, misses <base>, srcset, and JS links; swap for the
// extractor's DOM walk when link coverage matters.
const ANCHOR = /<a\b[^>]*?href\s*=\s*["']([^"'#]*)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi
export const extractLinks = (html: string, base: string): LinkCandidate[] =>
  [...html.matchAll(ANCHOR)].flatMap((m) => {
    const url = URL.parse(m[1] ?? '', base)
    if (!url?.protocol.startsWith('http')) return []
    return [{ url: url.href, anchor: (m[2] ?? '').replace(/<[^>]+>/g, ' ').trim() }]
  })
export const titleOf = (html: string) =>
  /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? ''
export const textOf = (html: string) => html.replace(/<[^>]+>/g, ' ')
/** Page text with each h1-h6 on its own '#'-prefixed line, for heading-tree chunks. */
export const headingText = (html: string) =>
  textOf(
    html
      .replace(/<h([1-6])\b[^>]*>/gi, (_, n: string) => `\n${'#'.repeat(Number(n))} `)
      .replace(/<\/h[1-6]\s*>/gi, '\n'),
  )

export interface FetchResponse {
  readonly status: number
  readonly body: string
  readonly headers: Headers | Record<string, string>
}
export type Fetcher = (url: string, signal?: AbortSignal) => Effect.Effect<FetchResponse, unknown>
/** jev/decisions.ts linkWorthFollowing with the goal bound in: one verdict per link. */
export type LinkJudge = (
  page: { url: string; title: string },
  links: ReadonlyArray<LinkCandidate>,
) => Effect.Effect<ReadonlyArray<boolean>, unknown>

export interface CrawlOptions {
  readonly fetch: Fetcher
  readonly dbPath: string
  readonly seeds?: ReadonlyArray<string>
  readonly resume?: string
  readonly userAgent?: string
  readonly maxPages?: number
  readonly memoryCap?: number
  readonly concurrency?: number
  /** Per-host delay floor; lower it only for local test servers. Defaults to MIN_DELAY_MS. */
  readonly minDelayMs?: number | undefined
  readonly sameOrigin?: boolean
  readonly linkWorthFollowing?: LinkJudge
  /** Defaults to the Effect Clock. */
  readonly now?: () => number
  readonly sleep?: (ms: number) => Effect.Effect<void>
}
interface CrawledPage {
  readonly url: string
  readonly status: number
  readonly body: string
}
type SkipReason = 'robots' | 'near-duplicate' | 'fetch-error'
export interface CrawlResult {
  readonly pages: CrawledPage[]
  readonly skipped: { url: string; reason: SkipReason }[]
  readonly resumeToken: string
  readonly done: boolean
}

export const ROBOTS_TTL_MS = 24 * 60 * 60 * 1000
export const floorOf = (r: Run) => r.o.minDelayMs ?? MIN_DELAY_MS
export const keepAll: LinkJudge = (_, links) => Effect.succeed(links.map(() => true))

export interface Run {
  readonly o: CrawlOptions
  readonly db: Database
  readonly token: string
  readonly frontier: Frontier
  readonly origins: Set<string>
  readonly robots: Map<string, { rules: Robots; at: number }>
  readonly delays: Map<string, number>
  /** Pigeonhole tables from local-index.ts: expected O(1 + n/2^16) per lookup. */
  readonly fingerprints: Fingerprints
  readonly result: CrawlResult
  readonly now: () => number
  readonly sleep: (ms: number) => Effect.Effect<void>
  visits: number
  inFlight: number
}
