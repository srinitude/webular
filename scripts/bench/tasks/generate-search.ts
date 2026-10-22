// Builds search.known-item, search.reasoning, search.long-tail, and
// search.multilingual from Wikidata, then writes bench/tasks/<split>/search.jsonl.
// Run: bun scripts/bench/tasks/generate-search.ts
import * as BunRuntime from '@effect/platform-bun/BunRuntime'
import { Effect } from 'effect'
import { type Task, writeSets } from './generate-common'
import { inLanguage, knownItem, longTail, reasoning, uniqueClues } from './generate-search-build'
import { fetchRows, type Query, type Row } from './generate-search-wikidata'
import plan from './search-plan.json'

const root = `${import.meta.dir}/../../..`
const BIG = 1_000_000
const BANDS = { head: [15, BIG], mid: [4, 12], low: [1, 3] } as const

// Each band of sitelink counts is one popularity slice: head, then mid and low (long-tail).
const enQueries = (band: keyof typeof BANDS) =>
  plan.domains.map(
    (d): Query => ({ ...d, lang: 'en', min: BANDS[band][0], max: BANDS[band][1], limit: 150 }),
  )

// Each language reads two domains, four apart, so every domain gets two languages.
const langQueries = plan.languages.flatMap((lang, i) =>
  [i, (i + 4) % plan.domains.length].map((j): Query => {
    const d = plan.domains[j] ?? plan.domains[0]
    return { domain: d?.domain ?? '', cls: d?.cls ?? '', lang, min: 3, max: BIG, limit: 30 }
  }),
)

type Batch = { readonly q: Query; readonly rows: ReadonlyArray<Row> }

const fetchAll = (qs: ReadonlyArray<Query>) =>
  Effect.forEach(qs, (q) => Effect.map(fetchRows(q), (rows): Batch => ({ q, rows })), {
    concurrency: 3,
  })

// One entity serves one task: the taker never hands out a QID twice.
const taker = () => {
  const used = new Set<string>()
  return <T extends { readonly row: Row }>(items: ReadonlyArray<T>, n: number) => {
    const picked = items.filter((t) => !used.has(t.row.qid)).slice(0, n)
    for (const t of picked) used.add(t.row.qid)
    return picked
  }
}
type Take = ReturnType<typeof taker>

const tagged = (b: Batch) => b.rows.map((row) => ({ row, domain: b.q.domain }))

// Known items: an even share per domain, then fill a short domain from the others
// (fill rows sit past the navigational slots, so the navigational cap holds).
const buildEnglish = (take: Take, head: ReadonlyArray<Batch>, low: ReadonlyArray<Batch>) => {
  const { knownItem: per, navigational, longTail: perLow } = plan.perDomain
  const pools = head.map(tagged)
  const first = pools.flatMap((p) => take(p, per).map((t, k) => ({ t, k })))
  const fill = take(pools.flat(), plan.domains.length * per - first.length).map((t) => ({
    t,
    k: per,
  }))
  const known = [...first, ...fill].map(({ t, k }) => knownItem(t.row, t.domain, k, navigational))
  const tail = low.flatMap((b) => take(tagged(b), perLow)).map((t) => longTail(t.row, t.domain))
  return [...known, ...tail]
}

// Even share per domain first, then fill any shortfall from the other domains' rows.
const buildReasoning = (take: Take, mid: ReadonlyArray<Batch>) => {
  const per = Math.ceil(plan.reasoningTotal / plan.domains.length)
  const pools = mid.map((b) => tagged({ q: b.q, rows: uniqueClues(b.rows) }))
  const first = pools.flatMap((p) => take(p, per)).slice(0, plan.reasoningTotal)
  const fill = take(pools.flat(), plan.reasoningTotal - first.length)
  return [...first, ...fill].map((t) => reasoning(t.row, t.domain))
}

// Rows of a language's two domains interleave, so both domains reach the task set.
const interleave = <T>(a: ReadonlyArray<T>, b: ReadonlyArray<T>) =>
  Array.from({ length: Math.max(a.length, b.length) }, (_, i) => [a[i], b[i]])
    .flat()
    .filter((x) => x !== undefined)

const buildLanguages = (take: Take, batches: ReadonlyArray<Batch>) =>
  plan.languages.flatMap((lang) => {
    const [a, b] = batches.filter((x) => x.q.lang === lang).map(tagged)
    const n = plan.perLanguage.knownItem + plan.perLanguage.multilingual
    return take(interleave(a ?? [], b ?? []), n).map((t, k) =>
      inLanguage(
        t.row,
        t.domain,
        lang,
        k < plan.perLanguage.knownItem ? 'search.known-item' : 'search.multilingual',
      ),
    )
  })

const countBy = (tasks: ReadonlyArray<Task>, key: (t: Task) => string) =>
  Object.fromEntries([...Map.groupBy(tasks, key)].map(([k, v]) => [k, v.length]))

const main = Effect.gen(function* () {
  const head = yield* fetchAll(enQueries('head'))
  const mid = yield* fetchAll(enQueries('mid'))
  const low = yield* fetchAll(enQueries('low'))
  const langs = yield* fetchAll(langQueries)
  const take = taker()
  const tasks = [
    ...buildEnglish(take, head, low),
    ...buildLanguages(take, langs),
    ...buildReasoning(take, mid),
  ]
  yield* writeSets(root, 'search', tasks)
  yield* Effect.log(
    JSON.stringify({ total: tasks.length, family: countBy(tasks, (t) => t.family) }),
  )
  yield* Effect.log(JSON.stringify({ domain: countBy(tasks, (t) => t.tags.domain) }))
  yield* Effect.log(JSON.stringify({ language: countBy(tasks, (t) => t.tags.language) }))
})

if (import.meta.main) BunRuntime.runMain(main)
