// Turns Wikidata rows into graded search tasks. Gold is only what the rows hold:
// the Wikipedia article (sitelink) and the official website (P856).
import { AUTHOR, BUILD_DATE, CANARY, type Task } from './generate-common'
import type { Row } from './generate-search-wikidata'

export const LICENSE = 'CC0-1.0 (Wikidata); gold holds Wikipedia and official-site URLs only'

export interface Spec {
  readonly family: string
  readonly domain: string
  readonly lang: string
  readonly queryType: string
  readonly query: string
  readonly relevant: ReadonlyArray<{ readonly url: string; readonly grade: number }>
  readonly longTail: boolean
}

export const task = (row: Row, s: Spec): Task => ({
  id: `${s.family}-${s.lang}-${row.qid}`,
  family: s.family,
  input: { query: s.query, lang: s.lang },
  gold: { relevant: s.relevant.filter((r) => r.url !== '') },
  aliases: [row.label],
  source: { url: `https://www.wikidata.org/wiki/${row.qid}`, asOf: BUILD_DATE, license: LICENSE },
  author: AUTHOR,
  buildDate: BUILD_DATE,
  questionType: s.queryType,
  tags: {
    domain: s.domain,
    language: s.lang,
    fresh: false,
    longTail: s.longTail,
    queryType: s.queryType,
    navigational: s.queryType === 'navigational',
    sitelinks: row.links,
  },
  canary: CANARY,
})

const KNOWN_ITEM_SHAPES = [
  { queryType: 'informational', query: (r: Row) => r.label },
  { queryType: 'definitional', query: (r: Row) => `what is ${r.label}` },
  { queryType: 'multi-intent', query: (r: Row) => `${r.label} ${r.desc}`.trim() },
] as const

// The first `nav` rows of each domain become "official site" lookups (navigational cap).
export const knownItem = (row: Row, domain: string, i: number, nav: number): Task => {
  const navigational = i < nav
  const shape = KNOWN_ITEM_SHAPES[i % KNOWN_ITEM_SHAPES.length] ?? KNOWN_ITEM_SHAPES[0]
  return task(row, {
    family: 'search.known-item',
    domain,
    lang: 'en',
    queryType: navigational ? 'navigational' : shape.queryType,
    query: navigational ? `${row.label} official website` : shape.query(row),
    relevant: navigational
      ? [
          { url: row.site, grade: 3 },
          { url: row.article, grade: 1 },
        ]
      : [
          { url: row.article, grade: 3 },
          { url: row.site, grade: 2 },
        ],
    longTail: false,
  })
}

// The entity's name is held back: the engine must reason from type, place, and year.
export const reasoning = (row: Row, domain: string): Task =>
  task(row, {
    family: 'search.reasoning',
    domain,
    lang: 'en',
    queryType: 'multi-constraint',
    query: `which ${row.desc} in ${row.country} dates from ${row.year}?`,
    relevant: [
      { url: row.article, grade: 3 },
      { url: row.site, grade: 2 },
    ],
    longTail: true,
  })

export const longTail = (row: Row, domain: string): Task =>
  task(row, {
    family: 'search.long-tail',
    domain,
    lang: 'en',
    queryType: row.country ? 'informational' : 'entity-lookup',
    query: row.country ? `${row.label} ${row.country}` : row.label,
    relevant: [
      { url: row.site, grade: 3 },
      { url: row.article, grade: 2 },
    ],
    longTail: true,
  })

export const inLanguage = (row: Row, domain: string, lang: string, family: string): Task =>
  task(row, {
    family,
    domain,
    lang,
    queryType: row.desc ? 'multi-intent' : 'informational',
    query: `${row.label} ${row.desc}`.trim(),
    relevant: [
      { url: row.article, grade: 3 },
      { url: row.site, grade: 2 },
      { url: row.enArticle, grade: 1 },
    ],
    longTail: row.links <= 12,
  })

// A description that two fetched entities share cannot name one page: drop both.
export const uniqueClues = (rows: ReadonlyArray<Row>): ReadonlyArray<Row> => {
  const key = (r: Row) => `${r.desc}|${r.country}|${r.year}`
  const counts = Map.groupBy(rows, key)
  return rows.filter(
    (r) => r.desc && r.country && /^\d{4}$/.test(r.year) && counts.get(key(r))?.length === 1,
  )
}
