// Benchmark numbers in the docs come only from the committed peer run with the
// highest recorded timestamp. Each doc holds marked blocks,
// `<!-- bench:start name -->` ... `<!-- bench:end -->`; this file rebuilds every
// block from bench/results and rewrites only those blocks.
// `mise run bench:docs` writes; tests/bench/bench-docs.test.ts fails on drift.
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { BunRuntime, BunServices } from '@effect/platform-bun'
import { Console, Data, Effect, FileSystem } from 'effect'
import { blocks, type Run } from './docs-blocks.ts'
import { type MatrixRow, matrixBlock, matrixHeadline, pickModelsRun } from './matrix.ts'

export const DOCS = ['README.md', 'docs/benchmarks.md', 'docs/benchmarks-peers.md'] as const
const PREFIX: Record<(typeof DOCS)[number], string> = {
  'README.md': 'bench/results/',
  'docs/benchmarks.md': '../bench/results/',
  'docs/benchmarks-peers.md': '../bench/results/',
}
const STAMP = /^peers-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z\.json$/
const BLOCK = /<!-- bench:start ([\w-]+) -->\n[\s\S]*?<!-- bench:end -->/g

export class BenchDocsError extends Data.TaggedError('BenchDocsError')<{ message: string }> {}

// The run whose file-name timestamp (written by the harness) is highest; never mtime.
export const pickRun = (names: readonly string[]) =>
  names
    .flatMap((n) => {
      const m = STAMP.exec(n)
      return m ? [{ n, t: Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5]}Z`) }] : []
    })
    .toSorted((a, b) => b.t - a.t)[0]?.n

// Rewrites each marked block. Block names the generator does not know come
// back in `unknown`, so the caller fails instead of leaving a stale block.
export const fill = (doc: string, bodies: Record<string, string>) => {
  const unknown: string[] = []
  const text = doc.replace(BLOCK, (whole, name: string) => {
    const body = bodies[name]
    if (body === undefined) unknown.push(name)
    return body === undefined ? whole : `<!-- bench:start ${name} -->\n${body}\n<!-- bench:end -->`
  })
  return { text, unknown }
}

// Benchmark-shaped numbers outside every generated block: scores, latencies, run names.
const STRAY = /\b\d\.\d{3}\b|\b\d+ ms\b|peers-\d{4}-\d{2}-\d{2}T/
export const strays = (doc: string) =>
  doc
    .replace(BLOCK, '')
    .split('\n')
    .filter((l) => STRAY.test(l))

const loadRun = (root: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const dir = `${root}bench/results/`
    const name = pickRun(yield* fs.readDirectory(dir))
    if (!name) return yield* new BenchDocsError({ message: `no peers-*.json in ${dir}` })
    const raw = yield* fs.readFileString(`${dir}${name}`)
    const txt = yield* fs.readFileString(`${dir}${name.replace(/\.json$/, '.txt')}`)
    const sha = createHash('sha256').update(raw).digest('hex').slice(0, 12)
    const json = yield* Effect.try({
      try: () => JSON.parse(raw) as Run['json'],
      catch: () => new BenchDocsError({ message: `${name} is not JSON` }),
    })
    return { name, sha, json, txt } satisfies Run
  })

// The agent matrix rows from the committed three-model agent run, if any.
const loadMatrix = (root: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const name = pickModelsRun(yield* fs.readDirectory(`${root}bench/results/`))
    if (!name) return { name, rows: [] as MatrixRow[] }
    const raw = yield* fs.readFileString(`${root}bench/results/${name}`)
    const rows = yield* Effect.try({
      try: () => (JSON.parse(raw) as { runs: MatrixRow[] }).runs,
      catch: () => new BenchDocsError({ message: `${name} is not JSON` }),
    })
    return { name, rows }
  })

type Matrix = Effect.Success<ReturnType<typeof loadMatrix>>

const bodies = (run: Run, m: Matrix, prefix: string) => {
  const b = blocks(run, prefix)
  return {
    ...b,
    readme: `${b['readme']}\n${matrixHeadline(m.rows, m.name)}`,
    matrix: matrixBlock(m.rows, m.name, prefix),
  }
}

const renderDoc = (root: string, run: Run, m: Matrix, path: (typeof DOCS)[number]) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const current = yield* fs.readFileString(`${root}${path}`)
    const { text, unknown } = fill(current, bodies(run, m, PREFIX[path]))
    if (unknown.length)
      return yield* new BenchDocsError({ message: `${path}: unknown blocks ${unknown.join(', ')}` })
    return { path, current, next: text }
  })

// Each doc's current text and its regenerated text, built in memory.
export const render = (root: string) =>
  Effect.gen(function* () {
    const run = yield* loadRun(root)
    const m = yield* loadMatrix(root)
    return yield* Effect.forEach(DOCS, (path) => renderDoc(root, run, m, path), { concurrency: 1 })
  })

if (import.meta.main) {
  const root = fileURLToPath(new URL('../../../', import.meta.url))
  const write = (d: { path: string; current: string; next: string }) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      if (d.next !== d.current) yield* fs.writeFileString(`${root}${d.path}`, d.next)
      yield* Console.log(`bench:docs ${d.path}: ${d.next === d.current ? 'current' : 'rewritten'}`)
    })
  const main = Effect.flatMap(render(root), (ds) => Effect.forEach(ds, write, { concurrency: 1 }))
  BunRuntime.runMain(main.pipe(Effect.provide(BunServices.layer)))
}
