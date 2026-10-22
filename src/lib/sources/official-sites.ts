// Navigational queries ("official website of X"): Wikipedia finds X's article
// but never X's own site, and no other keyless source ranks it. One SPARQL
// call reads each article's Wikidata official website (P856); those sites form
// a list in article order, fused like any source list. A query that also names
// a maker ("created by Rich Hickey") asks for the maker's products in the same
// call, so Wikidata's one-request-a-second slot never makes the lookup wait.
import { Deferred, Effect, Fiber, Option, Schema } from 'effect'
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
      const sites = articles.flatMap((u) => {
        const url = site.get(u)
        return url
          ? [
              {
                title: titles.get(u) ?? url,
                url,
                description: `Official website (Wikidata) of ${titles.get(u) ?? u}`,
              },
            ]
          : []
      })
      const made = results.bindings.filter((r) => !r.a)
      return creator ? [sites, productHits(made, creator, limit, query)] : [sites]
    }),
    Effect.catch(() => Effect.succeed([])),
  )
}

// Past the fan-out, the longest wait for the lookup; a later answer is dropped.
const OFFICIAL_WAIT_MS = 200

// The lookup forked beside the fan-out, fed by `runner`'s Wikipedia hits for
// the main query as the fan-out sends it (navCore cuts trailing "official
// website" words), never a variant, so one SPARQL call. `take` gives the sites
// when they land within OFFICIAL_WAIT_MS of the fan-out's end, else none.
export const officialBeside = Effect.fn('officialBeside')(function* (
  main: string,
  runner: SourceRunner,
  articles: number,
) {
  const maker = creatorOf(main)
  const wiki = yield* Deferred.make<ReadonlyArray<Hit>>()
  const lookup = yield* Effect.forkChild(
    Effect.flatMap(Deferred.await(wiki), (hits) => officialSites(hits, articles, main)),
  )
  const sent = navCore(main)
  const run: SourceRunner = (source, query, limit) =>
    source === 'wikipedia' && query === sent
      ? Effect.tap(runner(source, query, limit), (hits) => Deferred.succeed(wiki, hits))
      : runner(source, query, limit)
  const take = Effect.gen(function* () {
    if (!(yield* Deferred.isDone(wiki))) return [] as Hit[][]
    // A named maker's products have no other source, so its call is awaited in
    // full (the source timeout bounds it); a plain lookup gets the window.
    const join = Fiber.join(lookup)
    const lists = yield* maker ? Effect.asSome(join) : Effect.timeoutOption(join, OFFICIAL_WAIT_MS)
    return Option.getOrElse(lists, (): Hit[][] => [])
  }).pipe(Effect.ensuring(Fiber.interrupt(lookup)))
  return { run, take }
})
