// MAP workflow: discover URLs for a domain via its sitemap or page links.
// The sitemap fetch is host-scoped + byte-capped (fetchTextWithinHost) and does
// NOT follow off-host sitemap-index entries — no SSRF, no uncapped fetch.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { fetchTextWithinHost } from '../core/http.ts'
import { extractLinks } from '../lib/html.ts'

export const mapInput = z.object({
  url: z.string().url(),
  limit: z.number().int().positive().optional(),
})

export const mapOutput = z.object({
  url: z.string(),
  count: z.number(),
  links: z.array(z.string()),
})

function sameHost(host: string, candidate: string): boolean {
  try {
    return new URL(candidate).hostname === host
  } catch {
    return false
  }
}

async function fetchSitemapLinks(site: string): Promise<string[]> {
  const host = new URL(site).hostname
  try {
    const xml = await fetchTextWithinHost(`${site}/sitemap.xml`, host, { timeoutMs: 15_000 })
    const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1] ?? '')
    return locs.filter((u) => sameHost(host, u))
  } catch {
    return []
  }
}

async function fetchPageLinks(site: string): Promise<string[]> {
  const html = await fetchTextWithinHost(site, new URL(site).hostname)
  return extractLinks(html, site)
}

const discoverStep = createStep({
  id: 'discover',
  inputSchema: mapInput,
  outputSchema: mapOutput,
  execute: async ({ inputData }) => {
    const { url, limit = 1000 } = inputData
    const fromSitemap = await fetchSitemapLinks(url)
    const links = fromSitemap.length > 0 ? fromSitemap : await fetchPageLinks(url)
    const deduped = [...new Set(links)].slice(0, limit)
    return { url, count: deduped.length, links: deduped }
  },
})

export const mapWorkflow = createWorkflow({
  id: 'map',
  inputSchema: mapInput,
  outputSchema: mapOutput,
})
  .then(discoverStep)
  .commit()
