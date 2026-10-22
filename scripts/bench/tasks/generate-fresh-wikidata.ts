// answer.short fresh tasks: Wikidata statements whose start or publication
// date falls inside the 90-day window, read and checked by SPARQL on
// query.wikidata.org. Gold stores the value, the item's revision timestamp,
// and the entity URL.
import { Console, Effect, Schema } from 'effect'
import { AUTHOR, BUILD_DATE, CANARY, type Task } from './generate-common.ts'
import { EXPIRES, getJson, inWindow, WINDOW_START } from './generate-fresh-http.ts'
import kinds from './generate-fresh-kinds.json'

type Kind = (typeof kinds)[number]
type Row = Readonly<Record<string, { readonly value: string } | undefined>>

const Results = Schema.Struct({
  results: Schema.Struct({
    bindings: Schema.Array(Schema.Record(Schema.String, Schema.Struct({ value: Schema.String }))),
  }),
})

const label = (v: string, lang: string) =>
  `OPTIONAL { ?${v} rdfs:label ?${v}_${lang} FILTER(lang(?${v}_${lang}) = "${lang}") }`

// Current kinds require the statement to have no end date. Items with two
// values in the window are dropped later in `usable`.
const sparql = (k: Kind) => `SELECT * WHERE {
  ?item p:${k.prop} ?st. ?st ps:${k.prop} ?val; pq:${k.qualifier} ?when; wikibase:rank ?rank.
  FILTER(?rank != wikibase:DeprecatedRank)
  FILTER(?when >= "${WINDOW_START}T00:00:00Z"^^xsd:dateTime && ?when <= "${BUILD_DATE}T23:59:59Z"^^xsd:dateTime)
  ${k.current ? 'FILTER NOT EXISTS { ?st pq:P582 ?end }' : ''}
  ?item schema:dateModified ?mod.
  ${['en', 'zh', 'ko'].flatMap((l) => [label('item', l), label('val', l)]).join('\n  ')}
} LIMIT 400`

const pick = (row: Row, key: string) => row[key]?.value
const valueLabel = (row: Row, lang: string) =>
  pick(row, `val_${lang}`) ?? (pick(row, 'val')?.startsWith('http') ? undefined : pick(row, 'val'))

const language = (row: Row, i: number) => {
  const want = i % 3 === 1 ? 'zh' : i % 3 === 2 ? 'ko' : 'en'
  return pick(row, `item_${want}`) && valueLabel(row, want) ? want : 'en'
}

const FRESH_TAGS = {
  fresh: true,
  longTail: true,
  expires: EXPIRES,
  subtype: 'answer.short',
} as const

const questionFor = (k: Kind, row: Row, lang: string, when: string) =>
  (k[lang as 'en' | 'zh' | 'ko'] as string)
    .replace('{date}', BUILD_DATE)
    .replace('{when}', when)
    .replace('{subject}', pick(row, `item_${lang}`) ?? '')

const allLabels = (row: Row) =>
  ['en', 'zh', 'ko'].map((l) => valueLabel(row, l)).filter((x): x is string => x !== undefined)

const toTask = (k: Kind, row: Row, i: number): Task => {
  const qid = (pick(row, 'item') ?? '').replace('http://www.wikidata.org/entity/', '')
  const lang = language(row, i)
  const when = (pick(row, 'when') ?? '').slice(0, 10)
  const value = valueLabel(row, lang) ?? ''
  const question = questionFor(k, row, lang, when)
  const url = `https://www.wikidata.org/wiki/${qid}`
  const labels = allLabels(row)
  return {
    id: `fresh-answer-${qid}-${k.prop}`,
    family: 'answer',
    input: { question, subtype: 'answer.short' },
    gold: {
      value,
      valueId: pick(row, 'val'),
      revisionTimestamp: pick(row, 'mod'),
      statementDate: when,
      sourceUrl: url,
    },
    aliases: [...new Set([value, ...labels])],
    source: { url, asOf: pick(row, 'mod') ?? BUILD_DATE, license: 'CC0-1.0 (Wikidata)' },
    author: AUTHOR,
    buildDate: BUILD_DATE,
    questionType: 'factoid',
    tags: { ...FRESH_TAGS, domain: k.domain, language: lang },
    canary: CANARY,
  }
}

// One row per item: drop items whose window holds two values (ambiguous gold).
const usable = (rows: ReadonlyArray<Row>) => {
  const byItem = Map.groupBy(rows, (r) => pick(r, 'item') ?? '')
  return [...byItem.values()]
    .filter((g) => new Set(g.map((r) => pick(r, 'val'))).size === 1)
    .map((g) => g[0] as Row)
    .filter((r) => pick(r, 'item_en') && valueLabel(r, 'en') && inWindow(pick(r, 'when') ?? ''))
    .sort((a, b) => (pick(a, 'item') ?? '').localeCompare(pick(b, 'item') ?? ''))
}

const kindTasks = (k: Kind) =>
  getJson(
    `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql(k))}`,
    Results,
  ).pipe(
    Effect.map((r) =>
      usable(r.results.bindings)
        .slice(0, k.quota)
        .map((row, i) => toTask(k, row, i)),
    ),
    Effect.catch((e) =>
      Console.error(`wikidata ${k.prop} dropped: ${String(e).slice(0, 120)}`).pipe(
        Effect.as([] as Task[]),
      ),
    ),
  )

// The spec's quota of fresh answer.short tasks. The last two kinds only fill
// what the first five could not supply.
const ANSWER_QUOTA = 66

// Sequential: query.wikidata.org gives each client 60 s of CPU per minute.
export const wikidataTasks = Effect.forEach(kinds, kindTasks, { concurrency: 1 }).pipe(
  Effect.map((x) => x.flat().slice(0, ANSWER_QUOTA)),
)
