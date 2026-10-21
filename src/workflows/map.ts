// MAP workflow: discover URLs via the origin-root sitemap (with one-level
// <sitemapindex> recursion), then robots.txt Sitemap: entries, then page links. Same-host scoped, byte-capped, and
// deterministic: children fetch with bounded concurrency but merge in child
// order; dedup happens on normalized URLs after ordering.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { Effect, type FileSystem } from 'effect'
import { z } from 'zod'
import { hostConcurrency } from '../core/budget.ts'
import { fetchRoot, fetchTextWithinHost } from '../core/http.ts'
import { errMsg } from '../core/output.ts'
import { normalizeUrl, sameHost } from '../core/url.ts'
import { extractLinks } from '../lib/html.ts'
import { fetchErrorsSchema } from '../lib/sources.ts'
import { stepRuntime } from './runtime.ts'

const mapInput = z.object({
  url: z.string().url(),
  limit: z.number().int().positive().max(10_000).optional(),
  timeoutMs: z.number().int().positive().optional(),
})

const mapOutput = z.object({
  url: z.string(),
  count: z.number(),
  links: z.array(z.string()),
  errors: fetchErrorsSchema,
})

// The spec forbids nested indexes, so one recursion level suffices; the fetch
// count is capped to keep a hostile index bounded.
const MAX_CHILD_SITEMAPS = 10
const SITEMAP_TIMEOUT_MS = 15_000

interface Discovery {
  links: string[]
  errors: { url: string; reason: string }[]
}

type ChildResult =
  | { loc: string; ok: true; locs: string[] }
  | { loc: string; ok: false; reason: string }

function locsOf(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1] ?? '')
}

const fetchChild = (loc: string, host: string, timeoutMs: number): Effect.Effect<ChildResult> =>
  Effect.match(fetchTextWithinHost(loc, host, { timeoutMs }), {
    onFailure: (err): ChildResult => ({ loc, ok: false, reason: errMsg(err) }),
    onSuccess: (xml): ChildResult => ({ loc, ok: true, locs: locsOf(xml) }),
  })

function mergeChildren(host: string, results: ChildResult[]): Discovery {
  const out: Discovery = { links: [], errors: [] }
  for (const result of results) {
    // A loop, not push(...spread): a big child sitemap would overflow the
    // engine's argument limit and copy every loc twice.
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
  const sameHostLocs = locsOf(xml).filter((u) => sameHost(host, u))
  if (/<sitemapindex[\s>]/i.test(xml)) return yield* childLinks(sameHostLocs, host, budget)
  return { links: sameHostLocs, errors: [] } satisfies Discovery
})

const namedSitemap = (
  loc: string,
  host: string,
  budget: number,
): Effect.Effect<Discovery, never, FileSystem.FileSystem> =>
  Effect.catch(sitemapAt(loc, host, budget), (err) =>
    Effect.succeed({ links: [], errors: [{ url: loc, reason: errMsg(err) }] }),
  )

// robots.txt `Sitemap:` lines (key matched case-insensitively), same-host
// only, capped like index children. A missing robots.txt is a fallback (null);
// a named sitemap that fails is a reported error.
const robotsSitemaps = Effect.fn('map.robotsSitemaps')(function* (
  site: string,
  host: string,
  budget: number,
) {
  const txt = yield* Effect.option(
    fetchTextWithinHost(new URL('/robots.txt', site).toString(), host, { timeoutMs: budget }),
  )
  if (txt._tag === 'None') return null
  const locs = [...txt.value.matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)]
    .map((m) => m[1] ?? '')
    .filter((u) => sameHost(host, u))
    .slice(0, MAX_CHILD_SITEMAPS)
  const results = yield* Effect.forEach(locs, (loc) => namedSitemap(loc, host, budget), {
    concurrency: yield* hostConcurrency,
  })
  return {
    links: results.flatMap((r) => r.links),
    errors: results.flatMap((r) => r.errors),
  } satisfies Discovery
})

// Chain: /sitemap.xml, then robots.txt Sitemap: entries. null means "no
// sitemap" — the caller falls back to page links, which is not an error.
const fetchSitemap = Effect.fn('map.fetchSitemap')(function* (site: string, timeoutMs?: number) {
  const host = new URL(site).hostname
  const budget = timeoutMs ?? SITEMAP_TIMEOUT_MS
  const primary = yield* Effect.orElseSucceed(
    sitemapAt(new URL('/sitemap.xml', site).toString(), host, budget),
    () => null,
  )
  if (primary && primary.links.length > 0) return primary
  const robots = yield* robotsSitemaps(site, host, budget)
  if (!robots) return primary
  return { links: robots.links, errors: [...(primary?.errors ?? []), ...robots.errors] }
})

// Stops at `limit` kept links: work and memory are O(links read until the
// limit fills), not O(all sitemap links).
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

interface RootFetch {
  final: string
  rootHtml: string | null
  errors: { url: string; reason: string }[]
}

// The root is the user's explicit target: follow its redirects, anchor the
// sitemap origin and host scope on the FINAL url, and reuse the root's own
// HTML as the page-link fallback (no second fetch).
const fetchRootFor = (url: string, timeoutMs?: number): Effect.Effect<RootFetch> =>
  Effect.match(fetchRoot(url, { timeoutMs: timeoutMs ?? SITEMAP_TIMEOUT_MS }), {
    onFailure: (err): RootFetch => ({
      final: url,
      rootHtml: null,
      errors: [{ url, reason: errMsg(err) }],
    }),
    onSuccess: (entry): RootFetch => ({ final: entry.finalUrl, rootHtml: entry.html, errors: [] }),
  })

const discover = Effect.fn('map.discover')(function* (input: z.infer<typeof mapInput>) {
  const { url, limit = 1000, timeoutMs } = input
  const root = yield* fetchRootFor(url, timeoutMs)
  const sitemap = yield* fetchSitemap(root.final, timeoutMs)
  const links =
    sitemap && sitemap.links.length > 0
      ? sitemap.links
      : root.rootHtml
        ? extractLinks(root.rootHtml, root.final)
        : []
  const deduped = dedupe(links, limit)
  const errors = [...(deduped.length === 0 ? root.errors : []), ...(sitemap?.errors ?? [])]
  return { url, count: deduped.length, links: deduped, errors }
})

const discoverStep = createStep({
  id: 'discover',
  inputSchema: mapInput,
  outputSchema: mapOutput,
  execute: ({ inputData }) => stepRuntime.runPromise(discover(inputData)),
})

export const mapWorkflow = createWorkflow({
  id: 'map',
  inputSchema: mapInput,
  outputSchema: mapOutput,
})
  .then(discoverStep)
  .commit()
