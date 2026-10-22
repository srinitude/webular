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
  'marginalia',
  'github-search',
] as const
export type SearchSource = (typeof SEARCH_SOURCES)[number]

// At most this many --variant rewordings join the first search round.
export const MAX_VARIANTS = 2

// Known-item rewrite, no model: "what is Bruges" also asks for "Bruges", the
// entity the free title and repo indexes match. Added only below MAX_VARIANTS.
const QUESTION_LEAD = /^(?:what|who|where) (?:is|are|was) (?:an? |the )?/i
export const entityVariant = (query: string) => {
  const core = query.trim().replace(QUESTION_LEAD, '')
  return core && core !== query.trim() && !core.endsWith('?') ? [core] : []
}

// The first round's queries: the query, its rewordings, then its bare entity.
export const queriesFor = (query: string, given: ReadonlyArray<string> = []) => {
  const variants = given.slice(0, MAX_VARIANTS)
  return [query, ...variants, ...(variants.length < MAX_VARIANTS ? entityVariant(query) : [])]
}
