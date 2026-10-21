// A hit's source role and trust by its URL's site, so the main fused ranking
// reads the same table as the free-source fallback. Wikipedia is no free
// source, but it is a stable reference for factoid lookups.
import { type FreeSource, SOURCE_ROLE, SOURCE_TRUST } from './catalog.ts'

const SITE_SOURCE: Record<string, FreeSource> = {
  'wikidata.org': 'wikidata',
  'europepmc.org': 'europepmc',
  'nih.gov': 'ncbi-eutils',
  'crossref.org': 'crossref',
  'openalex.org': 'openalex',
  'loc.gov': 'loc',
  'openlibrary.org': 'openlibrary',
  'stackexchange.com': 'stackexchange',
  'stackoverflow.com': 'stackexchange',
  'github.com': 'github-search',
  'ycombinator.com': 'hn-algolia',
  'reddit.com': 'reddit',
  'bsky.app': 'bluesky',
}

// ponytail: registrable name = last two host labels, as domainSignal does.
const sourceOf = (url: string): FreeSource | 'wikipedia' | undefined => {
  const site = URL.parse(url)?.hostname.split('.').slice(-2).join('.') ?? ''
  return site === 'wikipedia.org' ? 'wikipedia' : SITE_SOURCE[site]
}

export const hostRole = (url: string): 'stable' | 'validation' | undefined => {
  const s = sourceOf(url)
  return s === 'wikipedia' ? 'stable' : s && SOURCE_ROLE[s]
}

// Trust of the hit's site; a site no source covers sits at the neutral middle.
export const NEUTRAL_TRUST = 0.5
export const hostTrust = (url: string): number => {
  const s = sourceOf(url)
  return s && s !== 'wikipedia' ? SOURCE_TRUST[s] : NEUTRAL_TRUST
}
