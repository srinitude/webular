// MAP workflow: origin-root sitemap (nested <sitemapindex> recursion, depth-capped), then robots.txt
// Sitemap: entries, then page links (see pageLinks). Same-host, byte-capped, ordered, deduped.
import { createWorkflow } from '@mastra/core/workflows'
import { Effect } from 'effect'
import { z } from 'zod'
import { hostConcurrency } from '../core/budget.ts'
import { fetchTextWithinHost } from '../core/http.ts'
import { HttpStatusError } from '../core/http-body.ts'
import { errMsg } from '../core/output.ts'
import { dedupeKey, normalizeUrl, sameHost } from '../core/url.ts'
import { archivedUrls } from '../lib/archive-urls.ts'
import { jevOrder } from '../lib/crawl.ts'
import { decisionStep } from '../lib/jev/steps.ts'
import { fetchRootFor, pageLinks } from '../lib/map-root.ts'
import { fetchErrorsSchema } from '../lib/sources.ts'
import { capPrefixes, locsOf, rootPrefix, withoutComments } from './map-xml.ts'
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

// Nested indexes recurse, but a hostile one is bounded: 10 children per index, and an
// index below MAX_INDEX_DEPTH levels is ignored (at most 1 + 10 + 100 fetches).
const MAX_CHILD_SITEMAPS = 10
const MAX_INDEX_DEPTH = 2
const SITEMAP_TIMEOUT_MS = 15_000

type MapServices = Effect.Services<ReturnType<typeof fetchTextWithinHost> | typeof hostConcurrency>

type Discovery = { links: string[]; errors: { url: string; reason: string }[] }

// Index children are read as sitemaps themselves, so a child index recurses. A child that
// fails is reported and the rest still count.
const childLinks = (
  locs: string[],
  host: string,
  timeoutMs: number,
  depth: number,
): Effect.Effect<Discovery, never, MapServices> =>
  Effect.gen(function* () {
    const concurrency = yield* hostConcurrency
    const results = yield* Effect.forEach(
      locs.slice(0, MAX_CHILD_SITEMAPS),
      (loc) =>
        Effect.catch(sitemapAt(loc, host, timeoutMs, depth), (err) =>
          Effect.succeed<Discovery>({ links: [], errors: [{ url: loc, reason: errMsg(err) }] }),
        ),
      { concurrency },
    )
    return {
      links: results.flatMap((r) => r.links),
      errors: results.flatMap((r) => r.errors),
    }
  })

// One sitemap URL: a <urlset>, or a <sitemapindex> that recurses up to MAX_INDEX_DEPTH. Fails
// when the fetch fails; callers decide whether that is a fallback or a reported error.
const sitemapAt = (
  sitemapUrl: string,
  host: string,
  budget: number,
  depth = 0,
): Effect.Effect<Discovery, Effect.Error<ReturnType<typeof fetchTextWithinHost>>, MapServices> =>
  Effect.gen(function* () {
    const xml = yield* fetchTextWithinHost(sitemapUrl, host, { timeoutMs: budget, gunzip: true })
    const prefix = rootPrefix(xml)
    const sameHostLocs = locsOf(xml, sitemapUrl, prefix).filter((u) => sameHost(host, u))
    if (new RegExp(`<${prefix}sitemapindex[\\s>]`, 'i').test(withoutComments(xml)))
      return depth >= MAX_INDEX_DEPTH
        ? ({ links: [], errors: [] } satisfies Discovery)
        : yield* childLinks(sameHostLocs, host, budget, depth + 1)
    return { links: sameHostLocs, errors: [] } satisfies Discovery
  }).pipe(Effect.withSpan('map.sitemapAt'))

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
  alreadyRead: string,
) {
  const robotsUrl = new URL('/robots.txt', site).toString()
  const txt = yield* Effect.option(fetchTextWithinHost(robotsUrl, host, { timeoutMs: budget }))
  if (txt._tag === 'None') return null
  const locs = [...txt.value.matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)]
    .map((m) => normalizeUrl(m[1] ?? '', robotsUrl) ?? '')
    .filter((u) => sameHost(host, u) && u !== alreadyRead)
    .slice(0, MAX_CHILD_SITEMAPS)
  const results = yield* Effect.forEach(locs, (loc) => namedSitemap(loc, host, budget), {
    concurrency: yield* hostConcurrency,
  })
  return { links: results.flatMap((r) => r.links), errors: results.flatMap((r) => r.errors) }
})

// Both sources count: /sitemap.xml, then every robots.txt Sitemap: entry (a site may name more there). null means "no sitemap": the caller falls back to page links, which is not an error.
const fetchSitemap = Effect.fn('map.fetchSitemap')(function* (site: string, timeoutMs?: number) {
  const host = new URL(site).hostname
  const budget = timeoutMs ?? SITEMAP_TIMEOUT_MS
  const xmlUrl = new URL('/sitemap.xml', site).toString()
  // A 404 means "no sitemap" (silent); any other failure is reported in errors.
  const primary = yield* Effect.catch(sitemapAt(xmlUrl, host, budget), (err) =>
    Effect.succeed<Discovery | null>(
      err instanceof HttpStatusError && err.status === 404
        ? null
        : { links: [], errors: [{ url: xmlUrl, reason: errMsg(err) }] },
    ),
  )
  // Every robots.txt Sitemap: line joins, after /sitemap.xml's own links.
  const robots = yield* robotsSitemaps(site, host, budget, xmlUrl)
  const errors = [...(primary?.errors ?? []), ...(robots?.errors ?? [])]
  const fromSitemapXml = (primary?.links.length ?? 0) > 0
  const links = [...(primary?.links ?? []), ...(robots?.links ?? [])]
  return robots || primary ? { links, errors, fromSitemapXml } : null
})

// Lee, Kim & Hong, "On URL Normalization" (ICCSA 2005): a trailing slash or a default
// document (index.html) names the same page as the bare path, so both share one key.
// The first form seen is kept, so a sitemap's own spelling wins over a page link's.
const pageKey = (link: string): string | null => {
  const url = URL.parse(dedupeKey(link) ?? '')
  if (!url) return null
  url.pathname = url.pathname.replace(/\/(?:index\.(?:html?|php|aspx?))?$/i, '')
  return url.toString()
}

// Stops at `limit` kept links: O(links read until the limit fills), not O(all links).
export function dedupe(links: string[], limit: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const link of links) {
    if (out.length >= limit) break
    const normalized = normalizeUrl(link)
    const key = pageKey(link)
    if (!normalized || !key || seen.has(key)) continue
    seen.add(key)
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
    const links = capPrefixes(ordered ?? d.unique, d.limit)
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
