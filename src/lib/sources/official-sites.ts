// Navigational queries ("official website of X"): Wikipedia finds X's article
// but never X's own site, and no other keyless source ranks it. One SPARQL
// call reads each article's Wikidata official website (P856); those sites form
// a list in article order, fused like any source list. A query that also names
// a maker ("created by Rich Hickey") asks for the maker's products in the same
// call, so Wikidata's one-request-a-second slot never makes the lookup wait.
import { Effect, Schema } from 'effect'
import { navCore, type SourceRunner } from '../search-source-run.ts'
import {
  creatorOf,
  productHits,
  queryFor as productsQuery,
  Row,
  sparql,
} from './creator-products.ts'
import type { Hit } from './polite.ts'

const NAVIGATIONAL = /\b(official|website|homepage|home page)\b/i
export const isNavigational = (query: string) =>
  !query.trim().endsWith('?') && NAVIGATIONAL.test(query)

const Binding = Schema.Struct({ value: Schema.String })
const Sparql = Schema.fromJsonString(
  Schema.Struct({
    results: Schema.Struct({
      bindings: Schema.Array(Schema.Struct({ ...Row.fields, a: Schema.optional(Binding) })),
    }),
  }),
)

// ponytail: article URLs as Wikipedia hits spell them (encodeURIComponent); a
// title Wikidata encodes differently (an apostrophe) simply finds no site.
const articlesPart = (articles: ReadonlyArray<string>) =>
  `{ VALUES ?a { ${articles.map((u) => `<${u}>`).join(' ')} } ?a schema:about ?item . ?item wdt:P856 ?site . }`

// Article rows carry ?a; product rows carry ?links, most-linked first.
const queryFor = (articles: ReadonlyArray<string>, creator: string | undefined, limit: number) => {
  const parts = [
    ...(articles.length > 0 ? [articlesPart(articles)] : []),
    ...(creator ? [`{ ${productsQuery(creator, limit * 2)} }`] : []),
  ]
  return `SELECT ?a ?site ?name ?desc ?links WHERE { ${parts.join(' UNION ')} } ORDER BY DESC(?links)`
}

const WIKI = /^https:\/\/en\.wikipedia\.org\/wiki\//

// The first official site of each article, in article order, as a hit.
const siteHits = (
  articles: ReadonlyArray<string>,
  site: ReadonlyMap<string, string>,
  titles: ReadonlyMap<string, string>,
): Hit[] =>
  articles.flatMap((u) => {
    const url = site.get(u)
    const title = titles.get(u)
    return url
      ? [{ title: title ?? url, url, description: `Official website (Wikidata) of ${title ?? u}` }]
      : []
  })

// Two lists: official sites for the Wikipedia articles among `hits` (first site
// per article, in article order), then the products of the maker `query` names.
// Any failure gives no lists, so the search stands as it was.
export const officialSites = (
  hits: ReadonlyArray<Hit>,
  limit: number,
  query = '',
): Effect.Effect<Hit[][]> => {
  const creator = creatorOf(query)
  const articles = [...new Set(hits.map((h) => h.url).filter((u) => WIKI.test(u)))].slice(0, limit)
  if (articles.length === 0 && !creator) return Effect.succeed([])
  const titles = new Map(hits.map((h) => [h.url, h.title]))
  return sparql(Sparql, queryFor(articles, creator, limit)).pipe(
    Effect.map(({ results }) => {
      const site = new Map<string, string>()
      for (const { a, site: s } of results.bindings)
        if (a && !site.has(a.value)) site.set(a.value, s.value)
      const sites = siteHits(articles, site, titles)
      const made = results.bindings.filter((r) => !r.a)
      return creator ? [sites, productHits(made, creator, limit, query)] : [sites]
    }),
    Effect.catch(() => Effect.succeed([])),
  )
}

// Wikipedia's search needs every word, so a trailing qualifier ("Gleam ... for
// the Erlang VM") hides the subject's article: ask for the words before the
// first preposition. A query that opens with the nav words ("official website
// of the Lisp for the JVM") is all qualifier and stays whole.
// ponytail: fixed English preposition list; a subject that holds one ("Lord of
// the Rings") loses its tail.
const QUALIFIER =
  /^(?!\s*(?:official|website|homepage|home page)\b)(.+?)\s+(?:for|by|of|on|in|from|with|at)\s.*$/i
const subjectOf = (query: string) => query.replace(QUALIFIER, '$1')

// Navigational queries: Wikipedia's list for the main query (as the fan-out
// sends it, navCore-cut, asked by its subject) leads with its articles'
// official sites, looked up the moment Wikipedia answers, inside that source's
// settle window. Variants skip it, so one SPARQL call per search.
export const withOfficial =
  (main: string, runner: SourceRunner, articles: number): SourceRunner =>
  (source, query, limit) =>
    source === 'wikipedia' && query === navCore(main)
      ? Effect.flatMap(runner(source, subjectOf(query), limit), (hits) =>
          Effect.map(officialSites(hits, articles, main), (lists) => [...lists.flat(), ...hits]),
        )
      : runner(source, query, limit)
