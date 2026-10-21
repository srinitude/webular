// The `search --source` names, apart from the fetchers in sources-search.ts so
// the command can check the flag without loading linkedom or the HTTP stack.
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
