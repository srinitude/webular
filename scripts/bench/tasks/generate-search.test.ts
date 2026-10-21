// Contract for the search family files: counts, quotas, canary on every row.
import { expect, test } from 'bun:test'
import { Effect, FileSystem, Schema } from 'effect'
import { eff } from '../../../tests/_support/run.ts'
import { CANARY, type Task } from './generate-common'

const root = `${import.meta.dir}/../../..`
const decodeLine = Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Unknown))

const read = (split: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const text = yield* fs.readFileString(`${root}/bench/tasks/${split}/search.jsonl`)
    const lines = yield* Effect.forEach(text.trim().split('\n'), (l) => decodeLine(l), {
      concurrency: 1,
    })
    expect(lines[0]).toEqual({ canary: CANARY })
    return lines.slice(1) as ReadonlyArray<Task>
  })

const checkQuotas = (mine: ReadonlyArray<Task>) => {
  const share = (f: (t: Task) => boolean) => mine.filter(f).length / mine.length
  const domains = new Set(mine.map((r) => r.tags.domain))
  expect(domains.size).toBeGreaterThanOrEqual(8)
  for (const d of domains) expect(share((r) => r.tags.domain === d)).toBeLessThanOrEqual(0.2)
  const langs = new Set(mine.map((r) => r.tags.language).filter((l) => l !== 'en'))
  expect(share((r) => r.tags.language !== 'en')).toBeGreaterThanOrEqual(0.2)
  expect(langs.size).toBeGreaterThanOrEqual(5)
  expect(langs.has('zh') && langs.has('ko')).toBe(true)
  expect(share((r) => r.tags.longTail)).toBeGreaterThanOrEqual(0.25)
  expect(mine.filter((r) => r.tags['navigational']).length).toBeLessThanOrEqual(26)
  const ml = mine.filter((r) => r.family === 'search.multilingual')
  expect(new Set(ml.map((r) => r.tags.language)).size).toBeGreaterThanOrEqual(8)
}

test(
  'search rows keep counts, quotas, and the canary',
  eff(
    Effect.gen(function* () {
      const rows = (yield* Effect.forEach(['dev', 'test', 'private'], read, {
        concurrency: 3,
      })).flat()
      const mine = rows.filter((r) => r.family !== 'search.fresh')
      expect(mine.length).toBeGreaterThan(200)
      expect(mine.length).toBeLessThanOrEqual(260)
      for (const r of rows) {
        expect(r.canary).toBe(CANARY)
        expect(r.source.url).toStartWith('https://')
        expect(r.source.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect((r.gold['relevant'] as ReadonlyArray<unknown>).length).toBeGreaterThan(0)
        expect(typeof r.tags['queryType']).toBe('string')
      }
      checkQuotas(mine)
    }),
  ),
)
