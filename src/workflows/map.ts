// MAP workflow: discover all URLs for a domain via sitemap or link extraction.
// Uses sitemapper (FOSS) for sitemaps; falls back to fetchText + extractLinks.
import { createStep, createWorkflow } from '@mastra/core/workflows'
import Sitemapper from 'sitemapper'
import { z } from 'zod'
import { fetchText } from '../core/http.ts'
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

async function fetchSitemapLinks(site: string, timeoutMs: number): Promise<string[]> {
  const mapper = new Sitemapper({ url: `${site}/sitemap.xml`, timeout: timeoutMs })
  try {
    const { sites } = await mapper.fetch()
    return Array.isArray(sites) ? (sites as string[]) : []
  } catch {
    return []
  }
}

async function fetchPageLinks(site: string): Promise<string[]> {
  const html = await fetchText(site)
  return extractLinks(html, site)
}

const discoverStep = createStep({
  id: 'discover',
  inputSchema: mapInput,
  outputSchema: mapOutput,
  execute: async ({ inputData }) => {
    const { url, limit = 1000 } = inputData
    let links = await fetchSitemapLinks(url, 15_000)
    if (links.length === 0) {
      links = await fetchPageLinks(url)
    }
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
