// The `search --source` names, apart from the fetchers in sources-search.ts so
// the command can check the flag without loading linkedom or the HTTP stack.
export const SEARCH_SOURCES = [
  'web',
  'wikipedia',
  'hackernews',
  'arxiv',
  'crossref',
  'openalex',
  'npm',
] as const
export type SearchSource = (typeof SEARCH_SOURCES)[number]

// At most this many --variant rewordings join the first search round.
export const MAX_VARIANTS = 2
