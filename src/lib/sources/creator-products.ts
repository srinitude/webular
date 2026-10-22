// Queries that name a product only by its maker ("created by Evan You", "uv by
// Astral"): no
// keyless source returns the product. One SPARQL call finds the items whose
// creator (P170), developer (P178) or founder (P112) carries that English
// label, reads each one's official website (P856), and ranks by sitelinks.
// ponytail: exact English label match; a nickname or alias finds nothing.
import { Clock, Context, Effect, Schema } from 'effect'
import { getJson, type Hit } from './polite.ts'

// Successful Wikidata answers by SPARQL text, for the process: a repeat lookup
// (the same query again, a retry) skips the network and the 1 s politeness
// slot. Bounded: at most SPARQL_CACHED entries, oldest out first, each kept
// SPARQL_TTL_MS. A Reference, so every caller shares one table unless a test
// provides its own. Failures are never kept.
const SPARQL_CACHED = 256
const SPARQL_TTL_MS = 3_600_000
export const SparqlCache = Context.Reference<Map<string, { at: number; value: unknown }>>(
  'webular/sources/SparqlCache',
  { defaultValue: () => new Map() },
)

// ponytail: keyed by query text alone; each query builder decodes with one
// schema, so a key never meets a second schema.
export const sparql = Effect.fn('sparql')(function* <A>(
  schema: Schema.Codec<A, string>,
  query: string,
) {
  const cache = yield* SparqlCache
  const now = yield* Clock.currentTimeMillis
  const kept = cache.get(query)
  if (kept && now - kept.at < SPARQL_TTL_MS) return kept.value as A
  const value = yield* getJson(schema, 'https://query.wikidata.org/sparql', {
    query,
    format: 'json',
  })
  cache.delete(query)
  cache.set(query, { at: now, value })
  for (const key of cache.keys()) {
    if (cache.size <= SPARQL_CACHED) break
    cache.delete(key)
  }
  return value
})

const NAME = String.raw`\p{Lu}[\p{L}\p{M}'’.-]*`
const MADE_BY = new RegExp(
  String.raw`\b(?:(?:created|made|developed|built|founded|designed|written)\s+)?by\s+(${NAME}(?:\s+${NAME})*)`,
  'u',
)
export const creatorOf = (query: string) => query.match(MADE_BY)?.[1]

const Binding = Schema.Struct({ value: Schema.String })
export const Row = Schema.Struct({
  site: Binding,
  name: Schema.optional(Binding),
  desc: Schema.optional(Binding),
})
const Sparql = Schema.fromJsonString(
  Schema.Struct({
    results: Schema.Struct({
      bindings: Schema.Array(Row),
    }),
  }),
)

export const queryFor = (creator: string, limit: number) =>
  `SELECT ?site ?name ?desc ?links WHERE { ?creator rdfs:label ${JSON.stringify(creator)}@en . ?item wdt:P170|wdt:P178|wdt:P112 ?creator ; wdt:P856 ?site ; wikibase:sitelinks ?links . OPTIONAL { ?item rdfs:label ?name FILTER(LANG(?name) = "en") } OPTIONAL { ?item schema:description ?desc FILTER(LANG(?desc) = "en") } } ORDER BY DESC(?links) LIMIT ${limit}`

// Official sites of the creator's products, most-linked first, one per site;
// no creator in the query, or any failure, gives no list.
export const creatorProducts = (query: string, limit: number): Effect.Effect<Hit[]> => {
  const creator = creatorOf(query)
  if (!creator) return Effect.succeed([])
  return sparql(Sparql, queryFor(creator, limit * 2)).pipe(
    Effect.map(({ results }) => productHits(results.bindings, creator, limit, query)),
    Effect.catch(() => Effect.succeed([])),
  )
}

// Query words (4+ letters) a product's English description shares: "the
// terminal emulator created by Mitchell Hashimoto" puts Ghostty ahead of the
// maker's better-linked products.
const overlap = (words: ReadonlyArray<string>, desc = '') =>
  words.filter((w) => desc.toLowerCase().includes(w)).length

// SPARQL rows as hits, one per site, at most `limit`: rows whose description
// shares the most query words first, most-linked first among equals.
export const productHits = (
  rows: ReadonlyArray<typeof Row.Type>,
  creator: string,
  limit: number,
  query = '',
): Hit[] => {
  const words = query.toLowerCase().match(/\p{L}{4,}/gu) ?? []
  const ranked = rows
    .map((row, i) => ({ row, i, n: overlap(words, row.desc?.value) }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
  const sites = new Map<string, Hit>()
  for (const {
    row: { site, name, desc },
  } of ranked) {
    const title = name?.value ?? site.value
    const about = desc ? `, ${desc.value}` : ''
    const description = `Official website (Wikidata) of ${title}${about}, by ${creator}`
    if (!sites.has(site.value)) sites.set(site.value, { title, url: site.value, description })
  }
  return [...sites.values()].slice(0, limit)
}
