// Navigational queries ("official website of X"): Wikipedia finds X's article
// but never X's own site, and no other keyless source ranks it. One SPARQL
// call reads each article's Wikidata official website (P856); those sites form
// a list in article order, fused like any source list.
import { Deferred, Effect, Fiber, Option, Schema } from 'effect'
import { navCore, type SourceRunner } from '../search-source-run.ts'
import { getJson, type Hit } from './polite.ts'

const NAVIGATIONAL = /\b(official|website|homepage|home page)\b/i
export const isNavigational = (query: string) =>
  !query.trim().endsWith('?') && NAVIGATIONAL.test(query)

const Binding = Schema.Struct({ value: Schema.String })
const Sparql = Schema.fromJsonString(
  Schema.Struct({
    results: Schema.Struct({
      bindings: Schema.Array(Schema.Struct({ a: Binding, site: Binding })),
    }),
  }),
)

// ponytail: article URLs as Wikipedia hits spell them (encodeURIComponent); a
// title Wikidata encodes differently (an apostrophe) simply finds no site.
const queryFor = (articles: ReadonlyArray<string>) =>
  `SELECT ?a ?site WHERE { VALUES ?a { ${articles.map((u) => `<${u}>`).join(' ')} } ?a schema:about ?item . ?item wdt:P856 ?site . }`

const WIKI = /^https:\/\/en\.wikipedia\.org\/wiki\//

// Official sites for the Wikipedia articles among `hits`, first site per article,
// in article order; any failure gives no list, so the search stands as it was.
export const officialSites = (hits: ReadonlyArray<Hit>, limit: number): Effect.Effect<Hit[]> => {
  const articles = [...new Set(hits.map((h) => h.url).filter((u) => WIKI.test(u)))].slice(0, limit)
  if (articles.length === 0) return Effect.succeed([])
  const titles = new Map(hits.map((h) => [h.url, h.title]))
  return getJson(Sparql, 'https://query.wikidata.org/sparql', {
    query: queryFor(articles),
    format: 'json',
  }).pipe(
    Effect.map(({ results }) => {
      const site = new Map<string, string>()
      for (const { a, site: s } of results.bindings)
        if (!site.has(a.value)) site.set(a.value, s.value)
      return articles.flatMap((u) => {
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
  const wiki = yield* Deferred.make<ReadonlyArray<Hit>>()
  const lookup = yield* Effect.forkChild(
    Effect.flatMap(Deferred.await(wiki), (hits) => officialSites(hits, articles)),
  )
  const sent = navCore(main)
  const run: SourceRunner = (source, query, limit) =>
    source === 'wikipedia' && query === sent
      ? Effect.tap(runner(source, query, limit), (hits) => Deferred.succeed(wiki, hits))
      : runner(source, query, limit)
  const take = Effect.gen(function* () {
    if (!(yield* Deferred.isDone(wiki))) return [] as Hit[]
    const sites = yield* Effect.timeoutOption(Fiber.join(lookup), OFFICIAL_WAIT_MS)
    return Option.getOrElse(sites, (): Hit[] => [])
  }).pipe(Effect.ensuring(Fiber.interrupt(lookup)))
  return { run, take }
})
