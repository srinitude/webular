// Reads search-task gold from the Wikidata SPARQL endpoint (CC0): entities of
// one class with an official website (P856) and a Wikipedia article.
import { Effect, Schedule } from 'effect'
import * as FetchHttpClient from 'effect/http/FetchHttpClient'
import * as HttpClient from 'effect/http/HttpClient'

const WDQS = 'https://query.wikidata.org/sparql'
export const UA = 'webular-bench-generator/1.0 (kiren@fantasymetals.com)'

export interface Row {
  readonly qid: string
  readonly label: string
  readonly desc: string
  readonly site: string
  readonly links: number
  readonly article: string
  readonly enArticle: string
  readonly country: string
  readonly year: string
}

export interface Query {
  readonly domain: string
  readonly cls: string
  readonly lang: string
  readonly min: number
  readonly max: number
  readonly limit: number
}

const sparql = (q: Query) => `SELECT ?item ?label ?desc ?site ?links ?art ?en ?cl ?inc WHERE {
  ?item wdt:P31 wd:${q.cls}; wdt:P856 ?site; wikibase:sitelinks ?links.
  FILTER(?links >= ${q.min} && ?links <= ${q.max})
  ?art schema:about ?item; schema:isPartOf <https://${q.lang}.wikipedia.org/>.
  ?item rdfs:label ?label FILTER(lang(?label) = "${q.lang}")
  OPTIONAL { ?item schema:description ?desc FILTER(lang(?desc) = "${q.lang}") }
  OPTIONAL { ?en schema:about ?item; schema:isPartOf <https://en.wikipedia.org/> }
  OPTIONAL { ?item wdt:P17 ?c. ?c rdfs:label ?cl FILTER(lang(?cl) = "en") }
  OPTIONAL { ?item wdt:P571 ?inc }
} LIMIT ${q.limit}`

type Field = { readonly value: string } | undefined
type Binding = {
  readonly [K in 'item' | 'label' | 'desc' | 'site' | 'links' | 'art' | 'en' | 'cl' | 'inc']?: Field
}
interface Results {
  readonly results: { readonly bindings: ReadonlyArray<Binding> }
}

const toRow = (b: Binding): Row => ({
  qid: (b.item?.value ?? '').split('/').pop() ?? '',
  label: b.label?.value ?? '',
  desc: b.desc?.value ?? '',
  site: b.site?.value ?? '',
  links: Number(b.links?.value ?? 0),
  article: b.art?.value ?? '',
  enArticle: b.en?.value ?? '',
  country: b.cl?.value ?? '',
  year: (b.inc?.value ?? '').slice(0, 4),
})

const queryUrl = (q: Query) => `${WDQS}?query=${encodeURIComponent(sparql(q))}`

// One row per entity: the endpoint repeats an item once per site, country, or date.
// Sorted by QID so a rerun on the same data picks the same entities.
export const fetchRows = (q: Query) =>
  Effect.gen(function* () {
    const client = HttpClient.filterStatusOk(yield* HttpClient.HttpClient)
    const res = yield* client.get(queryUrl(q), {
      headers: { accept: 'application/sparql-results+json', 'user-agent': UA },
    })
    const body = (yield* res.json) as unknown as Results
    const seen = new Map<string, Row>()
    for (const b of body.results.bindings) {
      const row = toRow(b)
      if (row.qid && row.label && /^https?:\/\//.test(row.site) && !seen.has(row.qid))
        seen.set(row.qid, row)
    }
    return [...seen.values()].sort((a, b) => a.qid.localeCompare(b.qid))
  }).pipe(
    Effect.timeout('90 seconds'),
    Effect.retry({ times: 2, schedule: Schedule.spaced('5 seconds') }),
    Effect.provide(FetchHttpClient.layer),
  )
