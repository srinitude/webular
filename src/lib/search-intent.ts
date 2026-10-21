// Which keyless free APIs a web search asks, by the query's intent.
import type { SearchSource } from './sources-search.ts'

// Free APIs per query intent; scraped engines (web = DuckDuckGo HTML) are the
// last fallback only, since from this IP they mostly answer 403/429/captcha.
// ponytail: keyword intent; swap in a Jev classifier if intent misses matter.
// "survey" stays out: land surveys (Everest 2020) are factual, not scholarly.
const SCHOLARLY =
  /\b(paper|papers|study|studies|research|journal|doi|arxiv|preprint|theorem|citations?)\b/i
// Navigational software queries also ask npm, whose package homepages are
// official sites the other free APIs never return.
const SOFTWARE = /\b(official|website|homepage|docs?|documentation|library|framework|github|npm)\b/i
export const pickSources = (query: string): SearchSource[] =>
  SCHOLARLY.test(query)
    ? ['openalex', 'arxiv', 'crossref', 'wikipedia']
    : SOFTWARE.test(query)
      ? ['wikipedia', 'hackernews', 'openalex', 'npm']
      : ['wikipedia', 'hackernews', 'openalex']
