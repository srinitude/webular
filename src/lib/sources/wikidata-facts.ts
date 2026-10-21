// Keyless Wikidata facts through the SPARQL endpoint (CC0 data; about one
// request a second, a descriptive User-Agent required, which getJson sends).
// One query finds entities by name with the mwapi EntitySearch service and
// reads each one's description, instance of, inception and country.
import { Effect, Schema } from 'effect'
import { getJson, type Hit } from './polite.ts'

const Binding = Schema.optional(Schema.Struct({ value: Schema.String }))

const Row = Schema.Struct({
  item: Binding,
  itemLabel: Binding,
  itemDescription: Binding,
  instanceLabel: Binding,
  inception: Binding,
  countryLabel: Binding,
})

const Sparql = Schema.fromJsonString(
  Schema.Struct({ results: Schema.Struct({ bindings: Schema.Array(Row) }) }),
)

// A row per entity per fact combination; this many rows cover a few entities.
const ROWS_PER_HIT = 12

const queryFor = (
  query: string,
  limit: number,
) => `SELECT ?item ?itemLabel ?itemDescription ?instanceLabel ?inception ?countryLabel WHERE {
  SERVICE wikibase:mwapi {
    bd:serviceParam wikibase:api "EntitySearch" ;
      wikibase:endpoint "www.wikidata.org" ;
      mwapi:search ${JSON.stringify(query)} ;
      mwapi:language "en" ;
      mwapi:limit "${limit}" .
    ?item wikibase:apiOutputItem mwapi:item .
  }
  OPTIONAL { ?item wdt:P31 ?instance }
  OPTIONAL { ?item wdt:P571 ?inception }
  OPTIONAL { ?item wdt:P17 ?country }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
} LIMIT ${limit * ROWS_PER_HIT}`

interface Facts {
  title: string
  description: string
  instance: Set<string>
  inception: Set<string>
  country: Set<string>
}

const collect = (rows: ReadonlyArray<typeof Row.Type>) => {
  const byItem = new Map<string, Facts>()
  for (const r of rows) {
    const uri = r.item?.value
    if (!uri) continue
    const facts = byItem.get(uri) ?? {
      title: r.itemLabel?.value ?? uri,
      description: r.itemDescription?.value ?? '',
      instance: new Set<string>(),
      inception: new Set<string>(),
      country: new Set<string>(),
    }
    if (r.instanceLabel) facts.instance.add(r.instanceLabel.value)
    // 1991-01-01T00:00:00Z reads as its date; a negative year keeps its sign.
    if (r.inception) facts.inception.add(r.inception.value.replace(/T.*$/, ''))
    if (r.countryLabel) facts.country.add(r.countryLabel.value)
    byItem.set(uri, facts)
  }
  return byItem
}

const line = (label: string, values: Set<string>) =>
  values.size ? `${label}: ${[...values].join(', ')}` : ''

const sentence = (f: Facts) =>
  [
    f.description,
    line('Instance of', f.instance),
    line('Inception', f.inception),
    line('Country', f.country),
  ]
    .filter(Boolean)
    .join('. ')

export const wikidataFacts = (query: string, limit: number): Effect.Effect<Hit[], unknown> =>
  getJson(Sparql, 'https://query.wikidata.org/sparql', {
    query: queryFor(query, limit),
    format: 'json',
  }).pipe(
    Effect.map(({ results }) =>
      [...collect(results.bindings)].map(([uri, f]) => ({
        title: f.title,
        url: uri.replace(/^http:/, 'https:'),
        description: sentence(f),
      })),
    ),
  )
