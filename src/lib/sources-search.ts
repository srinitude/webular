// Keyless specialized search sources for `search --source`: Wikipedia
// (MediaWiki Action API), Hacker News (Algolia), and arXiv (Atom export API);
// Crossref, OpenAlex, and npm live in scholarly.ts.
// All public, documented, no account. WEBULAR_SOURCE_ORIGIN swaps each
// endpoint's origin (path kept) so tests run against the local fixture.
import { Config, Effect, Schema } from 'effect'
import { DOMParser } from 'linkedom'
import { FetchError } from '../core/decode.ts'
import { fetchText } from '../core/http.ts'
import type { HttpStatusError } from '../core/http-body.ts'
import { removeAll } from '../core/remove-all.ts'

export { SEARCH_SOURCES, type SearchSource } from './search-source-names.ts'

// Per-attempt fetch budget for every search source. free-sources.json probes
// put these APIs at 0.35-0.97 s from this Mac; 2.5 s leaves 2.5x headroom.
export const SOURCE_TIMEOUT_MS = 2_500

interface SourceHit {
  title: string
  url: string
  description: string
}

export const endpoint = (base: string, params: Record<string, string>) =>
  Config.String('WEBULAR_SOURCE_ORIGIN').pipe(
    Config.withDefault(''),
    Effect.orDie,
    Effect.map((override) => {
      const url = new URL(base)
      const target = override ? new URL(url.pathname, override) : url
      target.search = new URLSearchParams(params).toString()
      return target.toString()
    }),
  )

// ponytail: tag strip + the five XML entities only; snippets are short and
// display-only, so a full HTML parse is not worth it.
export function plain(html: string): string {
  return removeAll(html, /<[^>]+>/g)
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim()
}

const decodeJson = Schema.decodeUnknownEffect(
  Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown)),
)

function getJson(
  url: string,
): Effect.Effect<Record<string, unknown>, FetchError | HttpStatusError> {
  return Effect.flatMap(fetchText(url, { timeoutMs: SOURCE_TIMEOUT_MS }), (body) =>
    Effect.mapError(
      decodeJson(body),
      () => new FetchError({ message: `fetch ${url}: response is not JSON` }),
    ),
  )
}

type Rec = Record<string, unknown>
const s = (r: Rec, k: string): string => (typeof r[k] === 'string' ? (r[k] as string) : '')

// Wikipedia full-text search ranks a raw question by its function words and
// reads "?" as a wildcard, so "What is the height of Mount Everest ...?" tops
// out at Chimborazo. Keep only the content words.
// ponytail: fixed English word list; extend it when a question form misses.
const FUNCTION_WORDS = new Set(
  'what who whom whose when where which why how is was were are be been did does do the a an in of on at for to by from with according meters metres feet miles kilometers city country year born'.split(
    ' ',
  ),
)
export const keywordQuery = (query: string): string =>
  (query.match(/[\p{L}\p{N}][\p{L}\p{N}'.,-]*[\p{L}\p{N}]|[\p{L}\p{N}]/gu) ?? [])
    .filter((w) => !FUNCTION_WORDS.has(w.toLowerCase()))
    .join(' ') || query

function wikipedia(
  query: string,
  limit: number,
): Effect.Effect<SourceHit[], FetchError | HttpStatusError> {
  return Effect.map(
    Effect.flatMap(
      endpoint('https://en.wikipedia.org/w/api.php', {
        action: 'query',
        list: 'search',
        srsearch: keywordQuery(query),
        srlimit: String(limit),
        format: 'json',
      }),
      getJson,
    ),
    (data) =>
      (((data['query'] as Rec | undefined)?.['search'] ?? []) as Rec[]).map((h) => ({
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
    Effect.flatMap(
      endpoint('https://hn.algolia.com/api/v1/search', {
        query,
        tags: 'story',
        hitsPerPage: String(limit),
      }),
      getJson,
    ),
    (data) =>
      ((data['hits'] ?? []) as Rec[]).map((h) => {
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
    Effect.flatMap(
      endpoint('https://export.arxiv.org/api/query', {
        search_query: `all:${query}`,
        max_results: String(limit),
      }),
      (url) => fetchText(url, { timeoutMs: SOURCE_TIMEOUT_MS }),
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
