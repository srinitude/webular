// Guards the research family files: counts, canary, required fields, quotas.

import { expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Effect, FileSystem, Schema } from 'effect'
import { CANARY, type Task } from './generate-common'

const root = `${import.meta.dir}/../../..`
const decode = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Unknown))

const load = Effect.forEach(
  ['dev', 'test', 'private'],
  (s) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const text = yield* fs.readFileString(`${root}/bench/tasks/${s}/research.jsonl`)
      return text
        .trim()
        .split('\n')
        .map((line) => decode(line))
    }),
  { concurrency: 3 },
)

const check = (
  name: string,
  f: (sets: ReadonlyArray<ReadonlyArray<unknown>>, tasks: Task[]) => void,
) =>
  test(name, () =>
    load.pipe(
      Effect.map((sets) => f(sets, sets.flatMap((rows) => rows.slice(1)) as Task[])),
      Effect.provide(BunServices.layer),
      Effect.runPromise,
    ),
  )

const share = (tasks: Task[], f: (t: Task) => boolean) => tasks.filter(f).length / tasks.length

check('every file opens with the canary and every task carries it', (sets, tasks) => {
  for (const rows of sets) expect(rows[0]).toEqual({ canary: CANARY })
  for (const t of tasks) expect(t.canary).toBe(CANARY)
})

check('every task has a source, tags, and question type', (_, tasks) => {
  for (const t of tasks) {
    expect(t.source.url).toStartWith('https://www.wikidata.org/wiki/Q')
    expect(t.source.license).toContain('CC0')
    expect(typeof t.tags['hops']).toBe('number')
    expect(t.questionType.length).toBeGreaterThan(0)
  }
})

check('ids are unique and counts stay within the plan', (_, tasks) => {
  expect(new Set(tasks.map((t) => t.id)).size).toBe(tasks.length)
  const by = Object.groupBy(tasks, (t) => String(t.tags['subfamily']))
  expect(by['research.multihop']?.length ?? 0).toBeLessThanOrEqual(150)
  expect(by['research.wide']?.length ?? 0).toBeLessThanOrEqual(30)
  expect(by['research.report']?.length ?? 0).toBeLessThanOrEqual(30)
})

check('domain quota: at least 8, none over 20%', (_, tasks) => {
  const domains = Object.groupBy(tasks, (t) => t.tags.domain)
  expect(Object.keys(domains).length).toBeGreaterThanOrEqual(8)
  for (const d of Object.values(domains))
    expect((d?.length ?? 0) / tasks.length).toBeLessThanOrEqual(0.2)
})

check('language, freshness, and long-tail quotas', (_, tasks) => {
  const langs = new Set(tasks.map((t) => t.tags.language).filter((l) => l !== 'en'))
  expect(langs.size).toBeGreaterThanOrEqual(5)
  expect(langs.has('zh') && langs.has('ko')).toBe(true)
  expect(share(tasks, (t) => t.tags.language !== 'en')).toBeGreaterThanOrEqual(0.2)
  expect(share(tasks, (t) => t.tags.fresh)).toBeGreaterThanOrEqual(0.2)
  expect(share(tasks, (t) => t.tags.longTail)).toBeGreaterThanOrEqual(0.25)
})
