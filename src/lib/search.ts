// Keyless web search via DuckDuckGo's no-JS HTML endpoint (fetch + linkedom),
// plus the ranking the fallback chain applies: reciprocal rank fusion with an
// official-domain signal. Headless and CI-safe — no browser, no API key.
import { Effect } from 'effect'
import { parseHTML } from 'linkedom'
import { fetchText } from '../core/http.ts'
import { dedupeKey } from '../core/url.ts'
import { searchRank } from './jev/decisions/search.ts'
import { onJevRuntime } from './jev/run.ts'
import { cleanHits, type Scored } from './search-diversify.ts'
import { endpoint, SOURCE_TIMEOUT_MS } from './sources-search.ts'

interface SearchHit {
  title: string
  url: string
  description: string
}

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
      headers: { accept: 'text/html,application/xhtml+xml' }, // fetchText sends the webular User-Agent
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

const MOBILE_HOST = /^(www|m|amp)\./

// Dedupe key (SearXNG-style): scheme, www./m./amp. host prefix, /amp suffix,
// trailing slash, tracking params, and hash do not tell two URLs apart.
export function hitKey(raw: string): string {
  const u = URL.parse(dedupeKey(raw) ?? '')
  if (!u) return raw
  const path = u.pathname.replace(/\/amp\/?$/, '').replace(/\/+$/, '')
  return `${u.hostname.replace(MOBILE_HOST, '')}${path}${u.search}`
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
// domain signal once per URL; deduped by hitKey, then near copies merge and a
// host-heavy top is spread (search-diversify.ts). Ties keep
// first-seen order; each entry carries its rank and the lists that returned it.
// `weights[li]` scales list li's RRF term (source class weight); missing is 1.
export function scoreHits<H extends SearchHit>(
  lists: ReadonlyArray<ReadonlyArray<H>>,
  query: string,
  weights: ReadonlyArray<number> = [],
): Scored<H>[] {
  const seen = new Map<string, { hit: H; score: number; lists: number[] }>()
  lists.forEach((list, li) => {
    list.forEach((hit, i) => {
      const key = hitKey(hit.url)
      const entry = seen.get(key) ?? { hit, score: domainSignal(hit.url, query), lists: [] }
      entry.score += (weights[li] ?? 1) / (RRF_K + i + 1)
      if (!entry.lists.includes(li)) entry.lists.push(li)
      if (hit.description.length > entry.hit.description.length)
        entry.hit = { ...entry.hit, description: hit.description }
      seen.set(key, entry)
    })
  })
  return cleanHits([...seen.values()].sort((a, b) => b.score - a.score))
}

export const rankHits = <H extends SearchHit>(
  lists: ReadonlyArray<ReadonlyArray<H>>,
  query: string,
): H[] => scoreHits(lists, query).map((e) => e.hit)

// Lexical rerank of the merged list, no model call: BM25 of the query over each
// hit's title, host, and snippet (Unicode word segmentation), scaled to 0..1,
// plus the Jaccard overlap of query and title words (so the exact title beats a
// longer one) and a boost for an official host or Wikipedia. The sort is stable,
// so ties and a query with no overlap keep the fused order.
const BM25_K1 = 1.2
const BM25_B = 0.75
const WIKI_BOOST = 0.25
const HOST_BOOST = 0.5
const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' })
const words = (s: string) =>
  [...segmenter.segment(s.toLowerCase())].filter((w) => w.isWordLike).map((w) => w.segment)

const bm25 = (docs: string[][], want: string[]) => {
  const avg = docs.reduce((n, d) => n + d.length, 0) / (docs.length || 1)
  const idf = (t: string) => {
    const df = docs.filter((d) => d.includes(t)).length
    return Math.log(1 + (docs.length - df + 0.5) / (df + 0.5))
  }
  const weights = want.map(idf)
  return docs.map((d) =>
    want.reduce((sum, t, i) => {
      const tf = d.filter((w) => w === t).length
      return (
        sum +
        (weights[i] ?? 0) *
          ((tf * (BM25_K1 + 1)) / (tf + BM25_K1 * (1 - BM25_B + (BM25_B * d.length) / avg)))
      )
    }, 0),
  )
}

export function lexicalRerank<H extends SearchHit>(hits: ReadonlyArray<H>, query: string): H[] {
  const want = [...new Set(words(query))]
  const docs = hits.map((h) =>
    words(`${h.title} ${URL.parse(h.url)?.hostname.replace(/[.-]/g, ' ') ?? ''} ${h.description}`),
  )
  const raw = bm25(docs, want)
  const top = Math.max(...raw)
  if (!(top > 0)) return [...hits]
  const score = hits.map((h, i) => {
    const site = URL.parse(h.url)?.hostname.split('.').slice(-2).join('.')
    const boost =
      domainSignal(h.url, query) > 0 ? HOST_BOOST : site === 'wikipedia.org' ? WIKI_BOOST : 0
    const title = new Set(words(h.title))
    const shared = want.filter((t) => title.has(t)).length
    return (raw[i] ?? 0) / top + shared / (want.length + title.size - shared) + boost
  })
  return hits
    .map((h, i) => ({ h, s: score[i] ?? 0 }))
    .sort((a, b) => b.s - a.s)
    .map((e) => e.h)
}

// Weak: the top hit is only one list's first place, with no second list
// agreeing and no official-site signal (1/61 = 0.0164; with either, >= 0.026).
export const WEAK_SCORE = 1.5 / (RRF_K + 1)
