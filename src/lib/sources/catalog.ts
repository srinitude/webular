// Every free source adapter by name, with how far its hits can be believed.
// registry.ts routes commands to these names and runs them.
import type { Effect } from 'effect'
import { crossref, openalex } from '../scholarly.ts'
import { commonCrawlCdx, libraryOfCongress, waybackAvailable, waybackCdx } from './archives.ts'
import { openLibrary } from './books.ts'
import { bluesky, reddit, stackExchange } from './communities.ts'
import { siteFeeds } from './feeds.ts'
import { gdelt, hnAlgolia } from './news.ts'
import type { Hit } from './polite.ts'
import { europePmc, ncbiEutils } from './scholarly.ts'
import { feedSearch, githubSearch, marginalia, wikidata } from './web.ts'
import { wikidataFacts } from './wikidata-facts.ts'

export const FREE_SOURCES = {
  wikidata,
  europepmc: europePmc,
  'ncbi-eutils': ncbiEutils,
  crossref,
  openalex,
  stackexchange: stackExchange,
  'github-search': githubSearch,
  marginalia,
  feedsearch: feedSearch,
  'site-feeds': siteFeeds,
  'wayback-available': waybackAvailable,
  'wayback-cdx': waybackCdx,
  'commoncrawl-cdx': commonCrawlCdx,
  loc: libraryOfCongress,
  reddit,
  bluesky,
  'hn-algolia': hnAlgolia,
  gdelt,
  'wikidata-sparql': wikidataFacts,
  openlibrary: openLibrary,
} as const satisfies Record<string, (query: string, limit: number) => Effect.Effect<Hit[], unknown>>

export type FreeSource = keyof typeof FREE_SOURCES

// How far each source's hits can be believed, in [0, 1]: curated and
// peer-reviewed indexes high, open community and web indexes lower.
// Jev hook point: a per-hit trust judgment (claim vs. source evidence) would
// replace this fixed table; it must keep the type (source: FreeSource) => number.
export const SOURCE_TRUST: Record<FreeSource, number> = {
  europepmc: 0.9,
  'ncbi-eutils': 0.9,
  crossref: 0.85,
  openalex: 0.85,
  loc: 0.85,
  wikidata: 0.8,
  'wikidata-sparql': 0.8,
  openlibrary: 0.8,
  'wayback-available': 0.7,
  'wayback-cdx': 0.7,
  'commoncrawl-cdx': 0.6,
  stackexchange: 0.6,
  'github-search': 0.5,
  feedsearch: 0.5,
  'site-feeds': 0.6,
  'hn-algolia': 0.5,
  gdelt: 0.5,
  marginalia: 0.4,
  reddit: 0.3,
  bluesky: 0.3,
}

// SOURCE_TERMS, the terms of use and rate limits for the keyless web index
// (a comment, not an export: no code reads it):
// - marginalia: about 15 queries a minute, shared by all on the public key; data CC-BY-NC-SA 4.0
// - github-search: unauthenticated core limit 60 an hour; search 10 a minute
// - web: DuckDuckGo HTML, terms unclear, so fallback only
// - mojeek: excluded, its site forbids automation and its API is paid
