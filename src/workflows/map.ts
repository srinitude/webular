// MAP workflow: discover URLs via the origin-root sitemap (with one-level
// <sitemapindex> recursion), then robots.txt Sitemap: entries, then page links. Same-host scoped, byte-capped, and
// deterministic: children fetch with bounded concurrency but merge in child
// order; dedup happens on normalized URLs after ordering.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import pLimit from 'p-limit'
import { z } from 'zod'
import { fetchRoot, fetchTextWithinHost } from '../core/http.ts'
import { errMsg } from '../core/output.ts'
import { normalizeUrl, sameHost } from '../core/url.ts'
import { extractLinks } from '../lib/html.ts'
import { fetchErrorsSchema } from '../lib/sources.ts'

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

async function fetchChild(loc: string, host: string, timeoutMs: number): Promise<ChildResult> {
  try {
    const xml = await fetchTextWithinHost(loc, host, { timeoutMs })
    return { loc, ok: true, locs: locsOf(xml) }
  } catch (err) {
    return { loc, ok: false, reason: errMsg(err) }
  }
}

async function childLinks(locs: string[], host: string, timeoutMs: number): Promise<Discovery> {
  const pool = pLimit(4)
  const results = await Promise.all(
    locs.slice(0, MAX_CHILD_SITEMAPS).map((loc) => pool(() => fetchChild(loc, host, timeoutMs))),
  )
  const out: Discovery = { links: [], errors: [] }
  for (const result of results) {
    if (result.ok) out.links.push(...result.locs.filter((u) => sameHost(host, u)))
    else out.errors.push({ url: result.loc, reason: result.reason })
  }
  return out
}

// One sitemap URL: a <urlset>, or a one-level <sitemapindex>. Throws when the
// fetch fails; callers decide whether that is a fallback or a reported error.
async function sitemapAt(sitemapUrl: string, host: string, budget: number): Promise<Discovery> {
  const xml = await fetchTextWithinHost(sitemapUrl, host, { timeoutMs: budget })
  const sameHostLocs = locsOf(xml).filter((u) => sameHost(host, u))
  if (/<sitemapindex[\s>]/i.test(xml)) return childLinks(sameHostLocs, host, budget)
  return { links: sameHostLocs, errors: [] }
}

async function namedSitemap(loc: string, host: string, budget: number): Promise<Discovery> {
  try {
    return await sitemapAt(loc, host, budget)
  } catch (err) {
    return { links: [], errors: [{ url: loc, reason: errMsg(err) }] }
  }
}

// robots.txt `Sitemap:` lines (key matched case-insensitively), same-host
// only, capped like index children. A missing robots.txt is a fallback (null);
// a named sitemap that fails is a reported error.
async function robotsSitemaps(
  site: string,
  host: string,
  budget: number,
): Promise<Discovery | null> {
  let txt: string
  try {
    txt = await fetchTextWithinHost(new URL('/robots.txt', site).toString(), host, {
      timeoutMs: budget,
    })
  } catch {
    return null
  }
  const locs = [...txt.matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)]
    .map((m) => m[1] ?? '')
    .filter((u) => sameHost(host, u))
    .slice(0, MAX_CHILD_SITEMAPS)
  const pool = pLimit(4)
  const results = await Promise.all(locs.map((loc) => pool(() => namedSitemap(loc, host, budget))))
  return { links: results.flatMap((r) => r.links), errors: results.flatMap((r) => r.errors) }
}

// Chain: /sitemap.xml, then robots.txt Sitemap: entries. null means "no
// sitemap" — the caller falls back to page links, which is not an error.
async function fetchSitemap(site: string, timeoutMs?: number): Promise<Discovery | null> {
  const host = new URL(site).hostname
  const budget = timeoutMs ?? SITEMAP_TIMEOUT_MS
  const primary = await sitemapAt(new URL('/sitemap.xml', site).toString(), host, budget).catch(
    () => null,
  )
  if (primary && primary.links.length > 0) return primary
  const robots = await robotsSitemaps(site, host, budget)
  if (!robots) return primary
  return { links: robots.links, errors: [...(primary?.errors ?? []), ...robots.errors] }
}

function dedupe(links: string[], limit: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const link of links) {
    const normalized = normalizeUrl(link)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
  }
  return out.slice(0, limit)
}

interface RootFetch {
  final: string
  rootHtml: string | null
  errors: { url: string; reason: string }[]
}

// The root is the user's explicit target: follow its redirects, anchor the
// sitemap origin and host scope on the FINAL url, and reuse the root's own
// HTML as the page-link fallback (no second fetch).
async function fetchRootFor(url: string, timeoutMs?: number): Promise<RootFetch> {
  try {
    const entry = await fetchRoot(url, { timeoutMs: timeoutMs ?? SITEMAP_TIMEOUT_MS })
    return { final: entry.finalUrl, rootHtml: entry.html, errors: [] }
  } catch (err) {
    return { final: url, rootHtml: null, errors: [{ url, reason: errMsg(err) }] }
  }
}

const discoverStep = createStep({
  id: 'discover',
  inputSchema: mapInput,
  outputSchema: mapOutput,
  execute: async ({ inputData }) => {
    const { url, limit = 1000, timeoutMs } = inputData
    const root = await fetchRootFor(url, timeoutMs)
    const sitemap = await fetchSitemap(root.final, timeoutMs)
    const links =
      sitemap && sitemap.links.length > 0
        ? sitemap.links
        : root.rootHtml
          ? extractLinks(root.rootHtml, root.final)
          : []
    const deduped = dedupe(links, limit)
    const errors = [...(deduped.length === 0 ? root.errors : []), ...(sitemap?.errors ?? [])]
    return { url, count: deduped.length, links: deduped, errors }
  },
})

export const mapWorkflow = createWorkflow({
  id: 'map',
  inputSchema: mapInput,
  outputSchema: mapOutput,
})
  .then(discoverStep)
  .commit()
