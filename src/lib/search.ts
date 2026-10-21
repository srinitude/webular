// Keyless web search via DuckDuckGo's no-JS HTML endpoint (fetch + linkedom),
// plus the ranking the fallback chain applies: reciprocal rank fusion with an
// official-domain signal. Headless and CI-safe — no browser, no API key.
import { Effect } from 'effect'
import { parseHTML } from 'linkedom'
import { fetchText } from '../core/http.ts'
import { searchRank } from './jev/decisions/search.ts'
import { onJevRuntime } from './jev/run.ts'
import { endpoint, SOURCE_TIMEOUT_MS } from './sources-search.ts'

interface SearchHit {
  title: string
  url: string
  description: string
}

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'

const decodeHref = (href: string): string =>
  URL.parse(href.startsWith('http') ? href : `https:${href}`)?.searchParams.get('uddg') ?? href

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

export const webSearch = Effect.fn('webSearch')(function* (query: string, limit: number) {
  const html = yield* fetchText(
    yield* endpoint('https://html.duckduckgo.com/html/', { q: query }),
    {
      timeoutMs: SOURCE_TIMEOUT_MS,
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
    },
  )
  const { document } = parseHTML(html)
  const hits: SearchHit[] = []
  for (const el of document.querySelectorAll('.result')) {
    const hit = toHit(el as unknown as Element)
    if (hit) hits.push(hit)
  }
  // Jev re-ranks by relevance before the limit cut; below 0.95 the engine order stays.
  const ranked = yield* onJevRuntime(searchRank, { query, hits })
  return ranked.slice(0, limit)
})

// Dedupe key: host without www, no trailing slash, no utm_* params, no hash.
export function hitKey(raw: string): string {
  const u = URL.parse(raw)
  if (!u) return raw
  for (const k of [...u.searchParams.keys()]) if (k.startsWith('utm_')) u.searchParams.delete(k)
  return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}${u.search}`
}

const RRF_K = 60
const OFFICIAL_BOOST = 0.01 // lifts an official hit above any unboosted rank
const AGGREGATOR_PENALTY = 0.001 // about four places down from the top
const AGGREGATORS = ['wikipedia.org', 'reddit.com', 'quora.com', 'medium.com']
const CODE_HOMES = ['github.com', 'npmjs.com', 'pypi.org', 'readthedocs.io']
const squash = (s: string) => s.toLowerCase().replace(/[-.\s]/g, '')

// Query terms: words of 3+ letters, plus the whole query squashed ("effect-ts" -> "effectts").
const terms = (query: string) =>
  new Set([
    ...query
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3),
    squash(query),
  ])

// ponytail: registrable name = second-to-last host label; multi-part TLDs
// (co.uk) miss the boost. Swap in a public-suffix list if that matters.
export function domainSignal(raw: string, query: string): number {
  const u = URL.parse(raw)
  if (!u) return 0
  const labels = u.hostname.split('.')
  const site = labels.slice(-2).join('.')
  if (AGGREGATORS.includes(site)) return -AGGREGATOR_PENALTY
  const names = CODE_HOMES.includes(site)
    ? [...labels.slice(0, -2), ...u.pathname.split('/').slice(1, 3)]
    : [labels.at(-2) ?? '']
  const want = terms(query)
  return names.some((n) => want.has(squash(n))) ? OFFICIAL_BOOST : 0
}

// Reciprocal rank fusion, sum(1/(60+rank)), over every ranked list, plus the
// domain signal once per URL; deduped by hitKey, ties keep first-seen order.
export function scoreHits<H extends SearchHit>(
  lists: ReadonlyArray<ReadonlyArray<H>>,
  query: string,
): Array<{ hit: H; score: number }> {
  const seen = new Map<string, { hit: H; score: number }>()
  for (const list of lists) {
    list.forEach((hit, i) => {
      const key = hitKey(hit.url)
      const entry = seen.get(key) ?? { hit, score: domainSignal(hit.url, query) }
      entry.score += 1 / (RRF_K + i + 1)
      seen.set(key, entry)
    })
  }
  return [...seen.values()].sort((a, b) => b.score - a.score)
}

export const rankHits = <H extends SearchHit>(
  lists: ReadonlyArray<ReadonlyArray<H>>,
  query: string,
): H[] => scoreHits(lists, query).map((e) => e.hit)

// Weak: the top hit is only one list's first place, with no second list
// agreeing and no official-site signal (1/61 = 0.0164; with either, >= 0.026).
export const WEAK_SCORE = 1.5 / (RRF_K + 1)
