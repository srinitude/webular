// Rescores agent-run chunk files under the shared scoring rules in
// tests/models/check.ts and merges every row into one run file named
// models-2026-10-22-<HHMMSS>-merged.json, which `mise run bench:docs` reads as
// the agent run with the highest name time.
//   bun scripts/bench/rescore.ts <HHMMSS> <chunk.json>...
// A chunk's raw replies live in <chunk root>/bench/results/raw, where the chunk
// root is the folder three levels above the chunk file.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Console, Effect, FileSystem, Schema } from 'effect'
import { missOf, usedAnyWebular } from '../../tests/models/check.ts'

interface Row {
  model: string
  surface: 'cli' | 'mcp' | 'plugin' | 'peer'
  provider: string
  task: string
  run: number
  pass: boolean
  skipped: boolean
  problems: readonly string[]
  toolCalls: readonly { name: string; input: unknown }[]
  raw: string
}

// A chunk keeps every field it holds; only `runs` is read as rows.
const Chunk = Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown))
const Result = Schema.fromJsonString(Schema.Struct({ result: Schema.optional(Schema.String) }))

const MATCH = /^reply does not match \/(.*)\/$/s

// Drops the problems the stored rules wrongly raised, keeps the real ones, labels the miss.
export const rescoreRow = <R extends Pick<Row, 'surface' | 'skipped' | 'problems' | 'toolCalls'>>(
  row: R,
  reply: string,
) => {
  const anyTool = row.surface !== 'peer' && usedAnyWebular(row.toolCalls, row.surface)
  const keep = (p: string) => {
    if (anyTool && p.startsWith('never called')) return false
    const src = MATCH.exec(p)?.[1]
    return src === undefined || !new RegExp(src, 'i').test(reply)
  }
  const problems = row.problems.filter(keep)
  return {
    ...row,
    problems,
    pass: problems.length === 0,
    miss: row.skipped ? null : missOf(problems),
  }
}

// The text of the last result event in a stream-json file.
const replyOf = (jsonl: string) => {
  const last = jsonl
    .split('\n')
    .filter((l) => l.includes('"type":"result"'))
    .at(-1)
  return last
    ? Schema.decodeUnknownEffect(Result)(last).pipe(Effect.map((r) => r.result ?? ''))
    : Effect.succeed('')
}

const key = (r: Row) => `${r.model}|${r.surface}|${r.provider}|${r.task}|${r.run}`

type Pair = { before: Row; after: ReturnType<typeof rescoreRow<Row>> }

const rescoreOne = (root: string) => (row: Row) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const reply = row.problems.some((p) => MATCH.test(p))
      ? yield* fs.readFileString(join(root, row.raw)).pipe(Effect.flatMap(replyOf))
      : ''
    return { before: row, after: rescoreRow(row, reply) } satisfies Pair
  })

const rescoreChunk = (file: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const chunk = yield* fs
      .readFileString(file)
      .pipe(Effect.flatMap(Schema.decodeUnknownEffect(Chunk)))
    const { runs, ...head } = chunk
    const root = dirname(dirname(dirname(file)))
    const pairs = yield* Effect.forEach(runs as readonly Row[], rescoreOne(root), {
      concurrency: 4,
    })
    return { head, pairs }
  })

type Cell = { n: number; was: number; now: number; miss: Map<string, number> }

const tally = (c: Cell, { before, after }: Pair) => {
  c.n++
  c.was += before.pass ? 1 : 0
  c.now += after.pass ? 1 : 0
  if (after.miss) c.miss.set(after.miss, (c.miss.get(after.miss) ?? 0) + 1)
}

// One line per model, surface, and provider: stored passes, rescored passes, miss labels.
const table = (pairs: readonly Pair[]) => {
  const cells = new Map<string, Cell>()
  for (const p of pairs.filter((q) => !q.before.skipped)) {
    const k = `${p.before.model} ${p.before.surface} ${p.before.provider}`
    const c = cells.get(k) ?? { n: 0, was: 0, now: 0, miss: new Map() }
    tally(c, p)
    cells.set(k, c)
  }
  return [...cells]
    .toSorted(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, c]) => {
      const miss = [...c.miss].map(([m, n]) => `${m} ${n}`).join(', ') || 'no misses'
      return `${k}: ${c.was} -> ${c.now} of ${c.n}; ${miss}`
    })
}

if (import.meta.main) {
  const [stamp, ...files] = process.argv.slice(2)
  const results = join(fileURLToPath(new URL('../../', import.meta.url)), 'bench/results')
  const main = Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const chunks = yield* Effect.forEach(files, rescoreChunk, { concurrency: 1 })
    const pairs = chunks.flatMap((c) => c.pairs)
    const dup = pairs.map((p) => key(p.before)).find((k, i, ks) => ks.indexOf(k) !== i)
    if (dup) return yield* Effect.die(`duplicate row ${dup}`)
    const rescoredFrom = files.map((f) => f.split('/').at(-1))
    const merged = { ...chunks[0]?.head, rescoredFrom, runs: pairs.map((p) => p.after) }
    const out = join(results, `models-2026-10-22-${stamp}-merged.json`)
    yield* fs.writeFileString(out, `${JSON.stringify(merged, null, 2)}\n`)
    yield* Console.log(`wrote ${out}: ${pairs.length} rows`)
    yield* Console.log(table(pairs).join('\n'))
  })
  BunRuntime.runMain(main.pipe(Effect.provide(BunServices.layer)))
}
