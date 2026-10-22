// Queries that name a product only by its maker ("created by Evan You"): no
// keyless source returns the product. One SPARQL call finds the items whose
// creator (P170), developer (P178) or founder (P112) carries that English
// label, reads each one's official website (P856), and ranks by sitelinks.
// ponytail: exact English label match; a nickname or alias finds nothing.
import { Effect, Schema } from 'effect'
import { getJson, type Hit } from './polite.ts'

const NAME = String.raw`\p{Lu}[\p{L}\p{M}'’.-]*`
const MADE_BY = new RegExp(
  String.raw`\b(?:created|made|developed|built|founded|designed|written)\s+by\s+(${NAME}(?:\s+${NAME})*)`,
  'u',
)
export const creatorOf = (query: string) => query.match(MADE_BY)?.[1]

const Binding = Schema.Struct({ value: Schema.String })
const Sparql = Schema.fromJsonString(
  Schema.Struct({
    results: Schema.Struct({
      bindings: Schema.Array(Schema.Struct({ site: Binding, name: Schema.optional(Binding) })),
    }),
  }),
)

const queryFor = (creator: string, limit: number) =>
  `SELECT ?site ?name WHERE { ?creator rdfs:label ${JSON.stringify(creator)}@en . ?item wdt:P170|wdt:P178|wdt:P112 ?creator ; wdt:P856 ?site ; wikibase:sitelinks ?links . OPTIONAL { ?item rdfs:label ?name FILTER(LANG(?name) = "en") } } ORDER BY DESC(?links) LIMIT ${limit}`

// Official sites of the creator's products, most-linked first, one per site;
// no creator in the query, or any failure, gives no list.
export const creatorProducts = (query: string, limit: number): Effect.Effect<Hit[]> => {
  const creator = creatorOf(query)
  if (!creator) return Effect.succeed([])
  return getJson(Sparql, 'https://query.wikidata.org/sparql', {
    query: queryFor(creator, limit * 2),
    format: 'json',
  }).pipe(
    Effect.map(({ results }) => {
      const sites = new Map<string, Hit>()
      for (const { site, name } of results.bindings) {
        const title = name?.value ?? site.value
        const description = `Official website (Wikidata) of ${title}, by ${creator}`
        if (!sites.has(site.value)) sites.set(site.value, { title, url: site.value, description })
      }
      return [...sites.values()].slice(0, limit)
    }),
    Effect.catch(() => Effect.succeed([])),
  )
}
