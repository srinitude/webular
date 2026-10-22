// Deterministic query reading, no model call: site:, year, and negation
// constraints, the plain keyword form of a question, and a deduped query list.
// A well-formed query comes back unchanged.
import { Effect } from 'effect'
import { asOfDate } from './as-of.ts'
import { MAX_VARIANTS } from './search-source-names.ts'

export type Constraints = {
  site?: string
  since?: number
  until?: number
  exclude: string[]
}
export type ParsedQuery = { keyword: string; constraints: Constraints }
type Hit = { title: string; url: string; description: string }

const SITE = /(?:^|\s)site:(\S+)/i
// Only the explicit "-Y" operator negates (one word or one quoted phrase); words
// like "without" are part of what the user wants ("laptops without fans").
const NOT = /(?:^|\s)-("[^"]+"|[\p{L}\p{N}][\p{L}\p{N}_.+#]*)/gu
const YEAR = '(?:19|20)\\d{2}'
const IN = new RegExp(`\\b(?:in|during)\\s+(${YEAR})\\b`, 'i')
const SINCE = new RegExp(`\\b(?:since|after)\\s+(${YEAR})\\b`, 'i')
const BEFORE = new RegExp(`\\b(?:before|until|through)\\s+(${YEAR})\\b`, 'i')
const RELATIVE = /\b(this|last)\s+year\b/i
// Leading question or request phrases: the only fillers stripped, so a title
// like "The Who" or "what is love" inside a real keyword query stays.
const LEAD =
  /^\s*(?:please\s+)?(?:(?:can|could|would)\s+you\s+(?:please\s+)?)?(?:(?:tell|show|give|find)\s+me\s+(?:about\s+)?|(?:what|who|which)\s+(?:is|are|was|were)\s+|how\s+(?:do|does|can|to)\s+(?:i\s+|you\s+|we\s+)?|why\s+(?:is|are|does|do)\s+|when\s+(?:is|was|did)\s+|where\s+(?:is|are|can\s+i\s+find)\s+)(?:the\s+|a\s+|an\s+)?/i
const TAIL = /\s*(?:\?+|please\.?)\s*$/i

const years = (c: Constraints, rest: string, thisYear: number): string => {
  const set = (re: RegExp, since: boolean, until: boolean, n: (m: RegExpExecArray) => number) => {
    const m = re.exec(rest)
    if (!m) return
    if (since) c.since = n(m)
    if (until) c.until = n(m)
    rest = rest.replace(re, ' ')
  }
  const year = (m: RegExpExecArray) => Number(m[1])
  set(IN, true, true, year)
  set(SINCE, true, false, year)
  set(BEFORE, false, true, year)
  set(RELATIVE, true, true, (m) => thisYear - (m[1]?.toLowerCase() === 'this' ? 0 : 1))
  return rest
}

// `asOf` is the run date (YYYY-MM-DD, from as-of.ts); it anchors "last year".
export const parseQuery = (query: string, asOf: string): ParsedQuery => {
  const c: Constraints = { exclude: [] }
  const site = SITE.exec(query)
  if (site?.[1]) c.site = site[1].toLowerCase().replace(/^www\./, '')
  const noSite = query.replace(SITE, ' ')
  for (const m of noSite.matchAll(NOT)) c.exclude.push((m[1] ?? '').replaceAll('"', ''))
  const rest = years(c, noSite.replace(NOT, ' '), Number(asOf.slice(0, 4)))
  const keyword = rest.replace(LEAD, '').replace(TAIL, '').replace(/\s+/g, ' ').trim()
  // Nothing recognized: the query stays exactly as written.
  return { keyword: keyword === query.trim() ? query : keyword || query, constraints: c }
}

// The first query is the plain keyword form; the original and the --variant
// rewordings follow, repeats dropped, capped at the one-round limit.
export const queryPlan = (
  query: string,
  asOf: string,
  variants: ReadonlyArray<string> = [],
): { query: string; variants: string[] } => {
  const { keyword } = parseQuery(query, asOf)
  const norm = (q: string) => q.trim().replace(/\s+/g, ' ').toLowerCase()
  const seen = new Set([norm(keyword)])
  const rest = [query, ...variants].filter((q) => !seen.has(norm(q)) && seen.add(norm(q)))
  return { query: keyword, variants: rest.slice(0, MAX_VARIANTS) }
}

const hostOf = (url: string) =>
  URL.canParse(url) ? new URL(url).hostname.toLowerCase().replace(/^www\./, '') : ''
const yearsIn = (text: string) => [...text.matchAll(/\b(?:19|20)\d{2}\b/g)].map((m) => Number(m[0]))

// Drop hits that break a constraint. A hit that names no year stays: hits
// carry no date field. ponytail: year-in-text is a coarse date proxy; a
// source date field would replace it.
export const matchesConstraints = (hit: Hit, c: Constraints): boolean => {
  if (c.site) {
    const host = hostOf(hit.url)
    if (host !== c.site && !host.endsWith(`.${c.site}`)) return false
  }
  const text = `${hit.title} ${hit.description}`.toLowerCase()
  if (c.exclude.some((w) => text.includes(w.toLowerCase()))) return false
  if (c.since === undefined && c.until === undefined) return true
  const found = yearsIn(`${hit.title} ${hit.description} ${hit.url}`)
  if (!found.length) return true
  return found.some((y) => y >= (c.since ?? 0) && y <= (c.until ?? 9999))
}

export const applyConstraints = <T extends Hit>(hits: T[], c: Constraints): T[] =>
  hits.filter((h) => matchesConstraints(h, c))

// The first query that names a constraint sets them: the keyword form drops
// them, so the original query rides along as a variant. The run date anchors
// "last year".
export const constraintsOf = (queries: ReadonlyArray<string>) =>
  Effect.map(
    asOfDate,
    (asOf): Constraints =>
      queries
        .map((q) => parseQuery(q, asOf).constraints)
        .find(
          (c) => c.site || c.since !== undefined || c.until !== undefined || c.exclude.length,
        ) ?? {
        exclude: [],
      },
  )
