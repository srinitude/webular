// Builds the research family (multihop, wide, report) from live Wikidata
// SPARQL reads (CC0). Gold comes only from those dated reads.
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Console, Effect } from 'effect'
import * as FetchHttpClient from 'effect/http/FetchHttpClient'
import * as HttpClient from 'effect/http/HttpClient'
import { AUTHOR, BUILD_DATE, CANARY, type Task, writeSets } from './generate-common'
import templates from './research-templates.json'

export type Template = (typeof templates)[number]
type Cell = { readonly value: string } | undefined
export type Row = {
  readonly [k in 'item' | 'a' | 't' | 'site' | 'links']?: Cell
} & { readonly [k: string]: Cell }

const ENDPOINT = 'https://query.wikidata.org/sparql'
const UA = 'webular-bench-generator/1.0 (kiren@fantasymetals.com)'
export const LICENSE = 'CC0-1.0 (https://www.wikidata.org/wiki/Wikidata:Licensing)'
const qid = (uri: string) => uri.slice(uri.lastIndexOf('/') + 1)
const val = (r: Row, k: string) => r[`${k}Label`]?.value ?? r[k]?.value ?? ''
const isId = (s: string) => s === '' || /^Q\d+$/.test(s)

const sparql = (
  t: Template,
) => `SELECT ?item ?itemLabel ?a ?aLabel ?t ?b ?bLabel ?c ?cLabel ?site ?links WHERE {
  ${t.body} ?item wikibase:sitelinks ?links .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${t.lang}". } } LIMIT 1500`

const fetchRows = (t: Template) =>
  Effect.gen(function* () {
    const http = yield* HttpClient.HttpClient
    const url = `${ENDPOINT}?format=json&query=${encodeURIComponent(sparql(t))}`
    const res = yield* http.get(url, {
      headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' },
    })
    const json = (yield* res.json) as { results: { bindings: ReadonlyArray<Row> } }
    return json.results.bindings
  }).pipe(
    Effect.timeout('58 seconds'),
    Effect.retry({ times: 2 }),
    Effect.orElseSucceed((): ReadonlyArray<Row> => []),
  )

const groupRows = (rows: ReadonlyArray<Row>) =>
  Map.groupBy(
    rows.filter((r) => r.item && !isId(val(r, 'item')) && !isId(val(r, 'a'))),
    (r) => qid(r.item?.value ?? ''),
  )

const base = (t: Template, id: string, r: Row, input: Record<string, unknown>) => ({
  id: `research.${t.sub}.${id}.${t.lang}`,
  family: 'research',
  input,
  source: { url: `https://www.wikidata.org/wiki/${id}`, asOf: BUILD_DATE, license: LICENSE },
  author: AUTHOR,
  buildDate: BUILD_DATE,
  canary: CANARY,
  tags: {
    domain: t.domain,
    language: t.lang,
    fresh: t.fresh,
    longTail: Number(r.links?.value ?? 0) < 15,
    hops: t.hops,
    subfamily: `research.${t.sub}`,
  },
})

const ask = (t: Template, r: Row) =>
  t.q.replace('{l}', val(r, 'item')).replace('{d}', (r.t?.value ?? '').slice(0, 10))

const multihop = (t: Template, id: string, answers: ReadonlyArray<Row>): Task | undefined => {
  const r = answers[0] as Row
  if (answers.length !== 1) return undefined
  const answer = val(r, 'a')
  const answerUrl = r.a?.value.startsWith('http') ? r.a.value : null
  const gold = { answer, answerUrl, changedOn: r.t?.value.slice(0, 10) ?? null }
  return {
    ...base(t, id, r, { question: ask(t, r) }),
    gold,
    aliases: [answer],
    questionType: 'short-answer',
  }
}

const wide = (t: Template, id: string, answers: ReadonlyArray<Row>): Task | undefined => {
  const r = answers[0] as Row
  if (answers.length < 2) return undefined
  const records = answers.map((x) => ({ name: val(x, 'a'), url: x.a?.value ?? '' }))
  return {
    ...base(t, id, r, { question: ask(t, r) }),
    gold: { records, complete: true },
    aliases: [],
    questionType: 'list',
  }
}

const report = (t: Template, id: string, r: Row): Task | undefined => {
  const facts = ['a', 'b', 'c'].map((k, i) => ({ item: t.rubric?.[i] ?? k, expected: val(r, k) }))
  if (facts.some((f) => isId(f.expected)) || !r.site) return undefined
  const citations = { minDistinctSources: 3, mustCite: [r.site.value], everyClaimCited: true }
  return {
    ...base(t, id, r, { prompt: ask(t, r) }),
    gold: { rubric: facts, citations },
    aliases: [],
    questionType: 'report',
  }
}

export const toTask = (t: Template, id: string, rs: ReadonlyArray<Row>): Task | undefined => {
  const answers = [...new Map(rs.map((x) => [x.a?.value, x])).values()]
  if (t.sub === 'multihop') return multihop(t, id, answers)
  if (t.sub === 'wide') return wide(t, id, answers)
  return report(t, id, rs[0] as Row)
}

// A later template never reuses an item an earlier one in the same
// subfamily took (the same medication in two languages, say).
export const pick = (rowsPer: ReadonlyArray<ReadonlyArray<Row>>): ReadonlyArray<Task> => {
  const seen = new Set<string>()
  return templates.flatMap((t, i) => {
    const out: Task[] = []
    for (const [id, rs] of groupRows(rowsPer[i] ?? [])) {
      const task = out.length < t.take && !seen.has(`${t.sub}${id}`) ? toTask(t, id, rs) : undefined
      if (task) out.push(task)
      if (task) seen.add(`${t.sub}${id}`)
    }
    return out
  })
}

const main = Effect.gen(function* () {
  const rowsPer = yield* Effect.forEach(templates, fetchRows, { concurrency: 2 })
  const tasks = pick(rowsPer)
  yield* writeSets(`${import.meta.dir}/../../..`, 'research', tasks)
  const count = (k: (t: Task) => string) =>
    Object.entries(Object.groupBy(tasks, k)).map(([n, a]) => `${n}=${a?.length}`)
  yield* Console.log(
    `research ${tasks.length}: ${count((t) => String(t.tags['subfamily'])).join(' ')}`,
  )
  yield* Console.log(`splits: ${count((t) => String(t.split)).join(' ')}`)
})

if (import.meta.main)
  BunRuntime.runMain(main.pipe(Effect.provide([FetchHttpClient.layer, BunServices.layer])))
