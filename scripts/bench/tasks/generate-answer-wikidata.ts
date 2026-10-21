// Reads dated facts from the Wikidata Query Service (CC0) for the answer family.
import { Effect } from 'effect'
import * as HttpClient from 'effect/http/HttpClient'
import * as HttpClientRequest from 'effect/http/HttpClientRequest'

const ENDPOINT = 'https://query.wikidata.org/sparql'
const UA = 'webular-bench-generator/1 (kiren@fantasymetals.com) polite batch build'

export const LANGS = ['en', 'zh', 'ko', 'ja', 'de', 'fr', 'es'] as const
export type Lang = (typeof LANGS)[number]

export interface Template {
  readonly domain: string
  readonly cls: string
  readonly prop: string
}

// One class and one property per domain; values are labels of linked items.
export const TEMPLATES: ReadonlyArray<Template> = [
  { domain: 'science', cls: 'Q11344', prop: 'P61' },
  { domain: 'health', cls: 'Q12136', prop: 'P780' },
  { domain: 'law', cls: 'Q820655', prop: 'P1001' },
  { domain: 'finance', cls: 'Q4830453', prop: 'P159' },
  { domain: 'software', cls: 'Q7397', prop: 'P178' },
  { domain: 'sports', cls: 'Q476028', prop: 'P115' },
  { domain: 'culture', cls: 'Q7725634', prop: 'P50' },
  { domain: 'local-government', cls: 'Q515', prop: 'P131' },
]

export interface Fact {
  readonly qid: string
  readonly label: string
  readonly sitelinks: number
  readonly values: ReadonlyArray<{ readonly qid: string; readonly label: string }>
}

type Binding = Record<string, { readonly value: string; readonly 'xml:lang'?: string }>
const v = (r: Binding | undefined, k: string) => r?.[k]?.value ?? ''

export const sparql = (query: string) =>
  Effect.gen(function* () {
    const http = yield* HttpClient.HttpClient
    const req = HttpClientRequest.get(
      `${ENDPOINT}?format=json&query=${encodeURIComponent(query)}`,
    ).pipe(
      HttpClientRequest.setHeader('User-Agent', UA),
      HttpClientRequest.setHeader('Accept', 'application/sparql-results+json'),
    )
    const res = yield* http.execute(req)
    const body = (yield* res.json) as { results: { bindings: ReadonlyArray<Binding> } }
    return body.results.bindings
  }).pipe(Effect.timeout('55 seconds'))

const qidOf = (uri: string) => uri.slice(uri.lastIndexOf('/') + 1)

export const factsFor = (t: Template, lang: Lang) =>
  sparql(`SELECT ?item ?il ?v ?vl ?sl WHERE {
  ?item wdt:P31 wd:${t.cls} ; wdt:${t.prop} ?v ; wikibase:sitelinks ?sl .
  ?item rdfs:label ?il FILTER(LANG(?il) = "${lang}")
  ?v rdfs:label ?vl FILTER(LANG(?vl) = "${lang}")
} LIMIT 400`).pipe(
    Effect.map((rows) =>
      [...Map.groupBy(rows, (r) => v(r, 'item')).values()].map(
        (g): Fact => ({
          qid: qidOf(v(g[0], 'item')),
          label: v(g[0], 'il'),
          sitelinks: Number(v(g[0], 'sl')),
          values: [...new Map(g.map((r) => [qidOf(v(r, 'v')), v(r, 'vl')])).entries()].map(
            ([qid, label]) => ({
              qid,
              label,
            }),
          ),
        }),
      ),
    ),
    Effect.orElseSucceed((): ReadonlyArray<Fact> => []),
  )

export const propLabels = (props: ReadonlyArray<string>) =>
  sparql(`SELECT ?p ?l WHERE {
  VALUES ?p { ${props.map((p) => `wd:${p}`).join(' ')} }
  ?p rdfs:label ?l FILTER(LANG(?l) IN (${LANGS.map((l) => `"${l}"`).join(',')}))
}`).pipe(
    Effect.map(
      (rows) =>
        new Map(rows.map((r) => [`${qidOf(v(r, 'p'))}:${r['l']?.['xml:lang'] ?? ''}`, v(r, 'l')])),
    ),
  )

// Plain "no value" statements: the source says outright that no value exists.
export const NO_VALUE: ReadonlyArray<{
  readonly prop: string
  readonly domain: string
  readonly cls: string
}> = [
  { prop: 'P40', domain: 'culture', cls: 'Q5' },
  { prop: 'P26', domain: 'culture', cls: 'Q5' },
  { prop: 'P36', domain: 'local-government', cls: 'Q6256' },
]

export const noValueFacts = (prop: string, cls: string) =>
  sparql(`SELECT ?item ?il ?sl WHERE {
  ?item wdt:P31 wd:${cls} ; p:${prop} ?st ; wikibase:sitelinks ?sl .
  ?st a wdno:${prop} .
  ?item rdfs:label ?il FILTER(LANG(?il) = "en")
} LIMIT 40`).pipe(
    Effect.map((rows) =>
      rows.map(
        (r): Fact => ({
          qid: qidOf(v(r, 'item')),
          label: v(r, 'il'),
          sitelinks: Number(v(r, 'sl')),
          values: [],
        }),
      ),
    ),
    Effect.orElseSucceed((): ReadonlyArray<Fact> => []),
  )
