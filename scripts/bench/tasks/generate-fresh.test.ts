import { expect, test } from 'bun:test'
import { Console, Effect, Schema } from 'effect'
import { BUILD_DATE, CANARY } from './generate-common'
import { EXPIRES, inWindow } from './generate-fresh-http'

const root = `${import.meta.dir}/../../..`
const decodeLine = Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Unknown))

type Row = {
  readonly id: string
  readonly canary: string
  readonly buildDate: string
  readonly input: { readonly subtype: string }
  readonly tags: { readonly fresh: boolean; readonly expires: string }
  readonly gold: {
    readonly statementDate?: string
    readonly publishedAt?: string
    readonly createdAt?: string
  }
}

// The private split lives only on the machine that built it, so it is optional here.
const readSplit = (split: string) =>
  Effect.gen(function* () {
    const file = Bun.file(`${root}/bench/tasks/${split}/fresh.jsonl`)
    if (split === 'private' && !(yield* Effect.tryPromise(() => file.exists()))) return []
    const lines = (yield* Effect.tryPromise(() => file.text())).trimEnd().split('\n')
    expect(yield* decodeLine(lines[0])).toEqual({ canary: CANARY })
    return (yield* Effect.forEach(lines.slice(1), (l) => decodeLine(l), {
      concurrency: 1,
    })) as ReadonlyArray<Row>
  })

const allRows = Effect.forEach(['dev', 'test', 'private'], readSplit, { concurrency: 3 }).pipe(
  Effect.map((x) => x.flat()),
)

test('fresh rows carry canary, build date, expiry, and an in-window date', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const rows = yield* allRows
      expect(rows.length).toBeGreaterThan(0)
      for (const r of rows) {
        expect([r.canary, r.buildDate, r.tags.fresh, r.tags.expires]).toEqual([
          CANARY,
          BUILD_DATE,
          true,
          EXPIRES,
        ])
        expect(inWindow(r.gold.statementDate ?? r.gold.publishedAt ?? r.gold.createdAt ?? '')).toBe(
          true,
        )
      }
      expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length)
      const count = (s: string) => rows.filter((r) => r.input.subtype === s).length
      yield* Console.log(
        `fresh quota: search.fresh ${count('search.fresh')}/60, answer.short ${count('answer.short')}/66`,
      )
      expect(count('search.fresh')).toBeLessThanOrEqual(60)
      expect(count('answer.short')).toBeLessThanOrEqual(66)
    }),
  ))
