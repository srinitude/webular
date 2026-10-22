// MAP workflow: origin-root sitemap (one-level <sitemapindex> recursion), then robots.txt
// Sitemap: entries, then page links (see pageLinks). Same-host, byte-capped, ordered, deduped.
import { createWorkflow } from '@mastra/core/workflows'
import { Effect } from 'effect'
import { z } from 'zod'
import { hostConcurrency } from '../core/budget.ts'
import { fetchTextWithinHost } from '../core/http.ts'
import { errMsg } from '../core/output.ts'
import { normalizeUrl, sameHost } from '../core/url.ts'
import { archivedUrls } from '../lib/archive-urls.ts'
import { jevOrder } from '../lib/crawl.ts'
import { decisionStep } from '../lib/jev/steps.ts'
import { fetchRootFor, pageLinks } from '../lib/map-root.ts'
import { fetchErrorsSchema } from '../lib/sources.ts'
import { stepRuntime } from './runtime.ts'

const mapInput = z.object({
  url: z.url(),
  limit: z.number().int().positive().max(10_000).optional(),
  timeoutMs: z.number().int().positive().optional(),
})

const mapOutput = z.object({
  url: z.string(),
  count: z.number(),
  links: z.array(z.string()),
  errors: fetchErrorsSchema,
})

// The spec forbids nested indexes, so one level suffices; a fetch cap bounds a hostile index.
const MAX_CHILD_SITEMAPS = 10
const SITEMAP_TIMEOUT_MS = 15_000

type Discovery = { links: string[]; errors: { url: string; reason: string }[] }

type ChildResult =
  | { loc: string; ok: true; locs: string[] }
  | { loc: string; ok: false; reason: string }

// Each loc resolves against the sitemap's own URL, so relative locs count.
function locsOf(xml: string, base: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].flatMap(
    (m) => normalizeUrl(m[1] ?? '', base) ?? [],
  )
}

const fetchChild = (loc: string, host: string, timeoutMs: number): Effect.Effect<ChildResult> =>
  Effect.match(fetchTextWithinHost(loc, host, { timeoutMs }), {
    onFailure: (err): ChildResult => ({ loc, ok: false, reason: errMsg(err) }),
    onSuccess: (xml): ChildResult => ({ loc, ok: true, locs: locsOf(xml, loc) }),
  })

function mergeChildren(host: string, results: ChildResult[]): Discovery {
  const out: Discovery = { links: [], errors: [] }
  for (const result of results) {
    // A loop, not push(...spread): a big child sitemap overflows the argument limit.
    if (!result.ok) {
      out.errors.push({ url: result.loc, reason: result.reason })
      continue
    }
    for (const u of result.locs) if (sameHost(host, u)) out.links.push(u)
  }
  return out
}

const childLinks = Effect.fnUntraced(function* (locs: string[], host: string, timeoutMs: number) {
  const concurrency = yield* hostConcurrency
  const results = yield* Effect.forEach(
    locs.slice(0, MAX_CHILD_SITEMAPS),
    (loc) => fetchChild(loc, host, timeoutMs),
    { concurrency },
  )
  return mergeChildren(host, results)
})

// One sitemap URL: a <urlset>, or a one-level <sitemapindex>. Fails when the
// fetch fails; callers decide whether that is a fallback or a reported error.
const sitemapAt = Effect.fn('map.sitemapAt')(function* (
  sitemapUrl: string,
  host: string,
  budget: number,
) {
  const xml = yield* fetchTextWithinHost(sitemapUrl, host, { timeoutMs: budget })
  const sameHostLocs = locsOf(xml, sitemapUrl).filter((u) => sameHost(host, u))
  if (/<sitemapindex[\s>]/i.test(xml)) return yield* childLinks(sameHostLocs, host, budget)
  return { links: sameHostLocs, errors: [] } satisfies Discovery
})

const namedSitemap = (loc: string, host: string, budget: number) =>
  Effect.catch(sitemapAt(loc, host, budget), (err) =>
    Effect.succeed<Discovery>({ links: [], errors: [{ url: loc, reason: errMsg(err) }] }),
  )

// robots.txt `Sitemap:` lines (key case-insensitive), same-host, capped like index children.
// A missing robots.txt is a fallback (null); a named sitemap that fails is a reported error.
const robotsSitemaps = Effect.fn('map.robotsSitemaps')(function* (
  site: string,
  host: string,
  budget: number,
) {
  const robotsUrl = new URL('/robots.txt', site).toString()
  const txt = yield* Effect.option(fetchTextWithinHost(robotsUrl, host, { timeoutMs: budget }))
  if (txt._tag === 'None') return null
  const locs = [...txt.value.matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)]
    .map((m) => normalizeUrl(m[1] ?? '', robotsUrl) ?? '')
    .filter((u) => sameHost(host, u))
    .slice(0, MAX_CHILD_SITEMAPS)
  const results = yield* Effect.forEach(locs, (loc) => namedSitemap(loc, host, budget), {
    concurrency: yield* hostConcurrency,
  })
  return { links: results.flatMap((r) => r.links), errors: results.flatMap((r) => r.errors) }
})

// Chain: /sitemap.xml, then robots.txt Sitemap: entries. null means "no sitemap": the caller falls back to page links, which is not an error.
const fetchSitemap = Effect.fn('map.fetchSitemap')(function* (site: string, timeoutMs?: number) {
  const host = new URL(site).hostname
  const budget = timeoutMs ?? SITEMAP_TIMEOUT_MS
  const xmlUrl = new URL('/sitemap.xml', site).toString()
  const primary = yield* Effect.orElseSucceed(sitemapAt(xmlUrl, host, budget), () => null)
  if (primary && primary.links.length > 0) return { ...primary, fromSitemapXml: true }
  const robots = yield* robotsSitemaps(site, host, budget)
  const errors = [...(primary?.errors ?? []), ...(robots?.errors ?? [])]
  return robots || primary ? { links: robots?.links ?? [], errors, fromSitemapXml: false } : null
})

// Stops at `limit` kept links: O(links read until the limit fills), not O(all links).
export function dedupe(links: string[], limit: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const link of links) {
    if (out.length >= limit) break
    const normalized = normalizeUrl(link)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
  }
  return out
}

const discover = Effect.fn('map.discover')(function* (input: z.infer<typeof mapInput>) {
  const { url, limit = 1000, timeoutMs } = input
  const root = yield* fetchRootFor(url, timeoutMs ?? SITEMAP_TIMEOUT_MS)
  const sitemap = yield* fetchSitemap(root.final, timeoutMs)
  const found = dedupe([...(sitemap?.links ?? []), ...pageLinks(root, sitemap)], Infinity)
  // The site would not answer at all: ask the archive indexes (2603.01548).
  const dead = found.length === 0 && root.errors.length > 0 && !root.blocked
  const unique = dead ? dedupe(yield* archivedUrls('map', root.final, limit), Infinity) : found
  return { url, site: root.final, limit, unique, root, sitemap }
})

// Rank-then-cut: past the limit, Jev's map.kind orders links best-first; ties,
// unsure answers, no key, and WEBULAR_JEV=off keep discovery order.
const discoverStep = decisionStep({
  id: 'discover',
  inputSchema: mapInput,
  outputSchema: mapOutput,
  decide: jevOrder,
  prepare: (input: z.infer<typeof mapInput>) => stepRuntime.runPromise(discover(input)),
  pick: (d) => (d.unique.length > d.limit ? { site: d.site, urls: d.unique } : undefined),
  output: (d, ordered) => {
    const links = (ordered ?? d.unique).slice(0, d.limit)
    const errors = [...(links.length === 0 ? d.root.errors : []), ...(d.sitemap?.errors ?? [])]
    return { url: d.url, count: links.length, links, errors }
  },
})

export const mapWorkflow = createWorkflow({
  id: 'map',
  inputSchema: mapInput,
  outputSchema: mapOutput,
  options: { shouldPersistSnapshot: () => false },
})
  .then(discoverStep)
  .commit()
