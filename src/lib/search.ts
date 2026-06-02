// Keyless web search via DuckDuckGo's no-JS HTML endpoint (fetch + linkedom).
// Headless and CI-safe — no browser, no API key. Shared by search/answer/research.
import { parseHTML } from 'linkedom'
import { fetchText } from '../core/http.ts'

export interface SearchHit {
  title: string
  url: string
  description: string
}

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'

function decodeHref(href: string): string {
  try {
    const u = new URL(href.startsWith('http') ? href : `https:${href}`)
    return u.searchParams.get('uddg') ?? href
  } catch {
    return href
  }
}

function toHit(el: Element): SearchHit | null {
  const anchor = el.querySelector('.result__a')
  const href = anchor?.getAttribute('href')
  if (!anchor || !href) return null
  const url = decodeHref(href)
  if (!url.startsWith('http')) return null
  const snippet = el.querySelector('.result__snippet')
  return {
    title: anchor.textContent?.trim() ?? '',
    url,
    description: snippet?.textContent?.trim() ?? '',
  }
}

export async function webSearch(query: string, limit: number): Promise<SearchHit[]> {
  const qs = new URLSearchParams({ q: query })
  const html = await fetchText(`https://html.duckduckgo.com/html/?${qs}`, {
    timeoutMs: 20_000,
    headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
  })
  const { document } = parseHTML(html)
  const hits: SearchHit[] = []
  for (const el of document.querySelectorAll('.result')) {
    const hit = toHit(el as unknown as Element)
    if (hit) hits.push(hit)
    if (hits.length >= limit) break
  }
  return hits
}
