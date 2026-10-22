// Search gold-set eval: runs `webular search` on the first N rows of the dev set,
// bench/tasks/dev/search.jsonl, and prints hit@10 accuracy and median latency.
// A row counts as a hit when any gold URL appears in the top 10 results.
// Usage: bun scripts/bench/search-gold.ts [rows=30] [concurrency=4]

import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Duration, Effect, Schema } from 'effect'
import { runProc } from '../../src/core/proc.ts'
import { normalizeUrl } from './grade.ts'
import { percentile } from './peers/score.ts'

const Row = Schema.fromJsonString(
  Schema.Struct({
    id: Schema.String,
    input: Schema.Struct({ query: Schema.String }),
    gold: Schema.Struct({ relevant: Schema.Array(Schema.Struct({ url: Schema.String })) }),
  }),
)

const root = new URL('../..', import.meta.url).pathname
const [rows = 30, concurrency = 4] = Bun.argv.slice(2).map(Number)

export const hitAt10 = (output: string, gold: readonly string[]): boolean => {
  const got = [...new Set((output.match(/https?:\/\/[^\s"<>\\]+/g) ?? []).map(normalizeUrl))].slice(
    0,
    10,
  )
  const want = new Set(gold.map(normalizeUrl))
  return got.some((u) => want.has(u))
}

const runOne = (row: typeof Row.Type) =>
  runProc(
    ['bun', `${root}src/commands/search.ts`, '--json', '--limit', '10', '--query', row.input.query],
    {
      timeoutMs: 20_000,
    },
  ).pipe(
    Effect.timed,
    Effect.map(([took, r]) => ({
      id: row.id,
      hit: hitAt10(
        r.stdout,
        row.gold.relevant.map((g) => g.url),
      ),
      ms: Duration.toMillis(took),
    })),
  )

const main = Effect.gen(function* () {
  // Tuning reads the dev set only; the sealed test set is for final scoring (bench/AGENTS.md).
  const text = yield* Effect.promise(() => Bun.file(`${root}bench/tasks/dev/search.jsonl`).text())
  const lines = text
    .split('\n')
    .filter((l) => l.includes('"gold"'))
    .slice(0, rows)
  const tasks = yield* Effect.forEach(lines, (l) => Schema.decodeUnknownEffect(Row)(l), {
    concurrency: 1,
  })
  const results = yield* Effect.forEach(tasks, runOne, { concurrency })
  for (const r of results)
    yield* Effect.logInfo(`${r.hit ? 'HIT ' : 'MISS'} ${Math.round(r.ms)}ms ${r.id}`)
  const hits = results.filter((r) => r.hit).length
  const accuracy = +(hits / results.length).toFixed(3)
  const medianMs = Math.round(
    percentile(
      results.map((r) => r.ms),
      50,
    ) ?? 0,
  )
  yield* Effect.logInfo(JSON.stringify({ n: results.length, accuracy, medianMs }))
})

if (import.meta.main) BunRuntime.runMain(main.pipe(Effect.provide(BunServices.layer)))
