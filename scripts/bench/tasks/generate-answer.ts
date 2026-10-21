// Builds the answer family (short, citation, false-premise, no-answer) from Wikidata.
import { BunRuntime } from '@effect/platform-bun'
import { Effect } from 'effect'
import * as FetchHttpClient from 'effect/http/FetchHttpClient'
import {
  factTask,
  falsePremiseTask,
  interleave,
  noAnswerTask,
  type Pick,
} from './generate-answer-build.ts'
import { seedTasks } from './generate-answer-seed.ts'
import {
  type Fact,
  factsFor,
  LANGS,
  type Lang,
  NO_VALUE,
  noValueFacts,
  propLabels,
  TEMPLATES,
} from './generate-answer-wikidata.ts'
import { type Task, writeSets } from './generate-common.ts'

const COUNTS = { short: 134, citation: 60, falsePremise: 40, noAnswer: 30 } as const
const NON_EN = LANGS.filter((l) => l !== 'en')

const fetchPools = Effect.forEach(
  TEMPLATES.flatMap((t) => LANGS.map((lang) => ({ t, lang }))),
  ({ t, lang }) =>
    factsFor(t, lang).pipe(Effect.map((f) => [`${t.domain}:${lang}`, interleave(f)] as const)),
  { concurrency: 3 },
).pipe(Effect.map((entries) => new Map<string, Array<Fact>>(entries)))

// Every third fact task goes to a non-English language; falls back to English when a pool runs dry.
const pickFacts = (
  pools: Map<string, Array<Fact>>,
  labels: Map<string, string>,
  n: number,
  offset: number,
) => {
  const out: Array<Pick> = []
  for (let i = 0; out.length < n && i < n * 4; i++) {
    const t = TEMPLATES[(i + offset) % TEMPLATES.length] as (typeof TEMPLATES)[number]
    const want: Lang = i % 3 === 2 ? (NON_EN[Math.floor(i / 3) % NON_EN.length] ?? 'en') : 'en'
    const lang = (pools.get(`${t.domain}:${want}`)?.length ?? 0) > 0 ? want : 'en'
    const fact = pools.get(`${t.domain}:${lang}`)?.shift()
    const propLabel = labels.get(`${t.prop}:${lang}`)
    if (fact && propLabel) out.push({ fact, domain: t.domain, prop: t.prop, propLabel, lang })
  }
  return out
}

// A wrong value is one taken from another item in the same domain that this item does not hold.
const wrongValue = (p: Pick, all: ReadonlyArray<Pick>) => {
  const mine = new Set(p.fact.values.map((v) => v.qid))
  return all
    .filter((o) => o.domain === p.domain && o.fact.qid !== p.fact.qid)
    .flatMap((o) => o.fact.values)
    .find((v) => !mine.has(v.qid))?.label
}

const noAnswerTasks = (labels: Map<string, string>) =>
  Effect.forEach(
    NO_VALUE,
    (nv) =>
      noValueFacts(nv.prop, nv.cls).pipe(
        Effect.map((facts) =>
          interleave(facts)
            .slice(0, COUNTS.noAnswer / NO_VALUE.length)
            .map((fact) =>
              noAnswerTask({
                fact,
                domain: nv.domain,
                prop: nv.prop,
                propLabel: labels.get(`${nv.prop}:en`) ?? nv.prop,
                lang: 'en',
              }),
            ),
        ),
      ),
    { concurrency: 3 },
  ).pipe(Effect.map((groups) => groups.flat()))

const falsePremiseTasks = (picks: ReadonlyArray<Pick>) =>
  picks
    .map((p) => [p, wrongValue(p, picks)] as const)
    .filter((pw): pw is readonly [Pick, string] => pw[1] !== undefined)
    .slice(0, COUNTS.falsePremise)
    .map(([p, w]) => falsePremiseTask(p, w))

export const build = Effect.gen(function* () {
  const labels = yield* propLabels([
    ...TEMPLATES.map((t) => t.prop),
    ...NO_VALUE.map((n) => n.prop),
  ])
  const pools = yield* fetchPools
  const facts = pickFacts(pools, labels, COUNTS.short + COUNTS.citation, 0)
  const enPools = new Map([...pools].filter(([k]) => k.endsWith(':en')))
  const fp = pickFacts(enPools, labels, COUNTS.falsePremise * 2, 3)
  const tasks: Array<Task> = [
    ...facts.slice(0, COUNTS.short).map((p) => factTask(p, 'short')),
    ...facts.slice(COUNTS.short).map((p) => factTask(p, 'citation')),
    ...falsePremiseTasks(fp),
    ...(yield* noAnswerTasks(labels)),
    ...seedTasks(),
  ]
  return tasks
})

const main = build.pipe(
  Effect.tap((tasks) => writeSets(`${import.meta.dir}/../../..`, 'answer', tasks)),
  Effect.tap((tasks) => Effect.log(`answer tasks: ${tasks.length}`)),
)

if (import.meta.main) BunRuntime.runMain(main.pipe(Effect.provide(FetchHttpClient.layer)))
