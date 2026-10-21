// Keyless specialized search sources for `search --source`: Wikipedia
// (MediaWiki Action API), Hacker News (Algolia), and arXiv (Atom export API);
// Crossref and OpenAlex live in search-chain.ts.
// All public, documented, no account. WEBULAR_SOURCE_ORIGIN swaps each
// endpoint's origin (path kept) so tests run against the local fixture.
import { Effect } from 'effect'
import { DOMParser } from 'linkedom'
import { FetchError } from '../core/decode.ts'
import { fetchText, type HttpStatusError } from '../core/http.ts'

interface SourceHit {
  title: string
  url: string
  description: string
}

// Also the fallback order for the default web source.
export const SEARCH_SOURCES = [
  'web',
  'wikipedia',
  'hackernews',
  'arxiv',
  'crossref',
  'openalex',
] as const
export type SearchSource = (typeof SEARCH_SOURCES)[number]

export function endpoint(base: string, params: Record<string, string>): string {
  const url = new URL(base)
  const override = process.env.WEBULAR_SOURCE_ORIGIN
  const target = override ? new URL(url.pathname, override) : url
  target.search = new URLSearchParams(params).toString()
  return target.toString()
}

// ponytail: tag strip + the five XML entities only; snippets are short and
// display-only, so a full HTML parse is not worth it.
export function plain(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim()
}

function getJson(
  url: string,
): Effect.Effect<Record<string, unknown>, FetchError | HttpStatusError> {
  return Effect.flatMap(fetchText(url, { timeoutMs: 20_000 }), (body) =>
    Effect.try({
      try: () => JSON.parse(body) as Record<string, unknown>,
      catch: () => new FetchError({ message: `fetch ${url}: response is not JSON` }),
    }),
  )
}

type Rec = Record<string, unknown>
const s = (r: Rec, k: string): string => (typeof r[k] === 'string' ? (r[k] as string) : '')

function wikipedia(
  query: string,
  limit: number,
): Effect.Effect<SourceHit[], FetchError | HttpStatusError> {
  return Effect.map(
    getJson(
      endpoint('https://en.wikipedia.org/w/api.php', {
        action: 'query',
        list: 'search',
        srsearch: query,
        srlimit: String(limit),
        format: 'json',
      }),
    ),
    (data) =>
      (((data.query as Rec | undefined)?.search ?? []) as Rec[]).map((h) => ({
        title: s(h, 'title'),
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(s(h, 'title').replace(/ /g, '_'))}`,
        description: plain(s(h, 'snippet')),
      })),
  )
}

function hackernews(
  query: string,
  limit: number,
): Effect.Effect<SourceHit[], FetchError | HttpStatusError> {
  return Effect.map(
    getJson(
      endpoint('https://hn.algolia.com/api/v1/search', {
        query,
        tags: 'story',
        hitsPerPage: String(limit),
      }),
    ),
    (data) =>
      ((data.hits ?? []) as Rec[]).map((h) => {
        const discussion = `https://news.ycombinator.com/item?id=${s(h, 'objectID')}`
        return {
          title: s(h, 'title'),
          url: s(h, 'url') || discussion,
          description: plain(s(h, 'story_text')) || discussion,
        }
      }),
  )
}

function parseArxiv(xml: string): SourceHit[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const text = (el: Element, tag: string): string =>
    el.getElementsByTagName(tag)[0]?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
  return [...doc.getElementsByTagName('entry')].map((e) => ({
    title: text(e as unknown as Element, 'title'),
    url: text(e as unknown as Element, 'id'),
    description: text(e as unknown as Element, 'summary'),
  }))
}

function arxiv(
  query: string,
  limit: number,
): Effect.Effect<SourceHit[], FetchError | HttpStatusError> {
  return Effect.map(
    fetchText(
      endpoint('https://export.arxiv.org/api/query', {
        search_query: `all:${query}`,
        max_results: String(limit),
      }),
      { timeoutMs: 20_000 },
    ),
    parseArxiv,
  )
}

const BACKENDS = {
  wikipedia,
  hackernews,
  arxiv,
} satisfies Record<string, typeof wikipedia>

export function sourceSearch(
  source: keyof typeof BACKENDS,
  query: string,
  limit: number,
): Effect.Effect<SourceHit[], FetchError | HttpStatusError> {
  return Effect.map(BACKENDS[source](query, limit), (hits) => hits.slice(0, limit))
}
