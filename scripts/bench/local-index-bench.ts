// Local index benchmark: build time and memory for a seeded synthetic corpus
// (Zipf-like vocabulary) with the harness fixture pages planted inside, query
// p50/p95 over random queries, and recall@5 on the fixture questions.
// Run: bun scripts/bench/local-index-bench.ts [docs]
import { Clock, Console, Effect } from 'effect'
import {
  addPages,
  type IndexedPage,
  type LocalIndex,
  openLocalIndex,
  searchLocal,
} from '../../src/lib/local-index.ts'

const DOCS = Number(Bun.argv[2] ?? 20_000)

const xorshift = (state: { s: number }) => () => {
  state.s ^= state.s << 13
  state.s ^= state.s >>> 17
  state.s ^= state.s << 5
  return (state.s >>> 0) / 0x1_0000_0000
}
const rand = xorshift({ s: 0x9e3779b9 })
const VOCAB = Array.from({ length: 30_000 }, (_, i) => `w${i.toString(36)}`)
const word = () => VOCAB[Math.floor(VOCAB.length * rand() ** 3)] as string
const sentence = (n: number) => Array.from({ length: n }, word).join(' ')

const page = (url: string, title: string, text: string): IndexedPage => ({ url, title, text })
const planted = [
  {
    page: page(
      'fixture://article',
      'Tidal Power in the Bay of Fundy',
      'The Bay of Fundy has the highest tides on Earth, with a range that can reach 16 metres.',
    ),
    query: 'which bay has the highest tides on earth',
  },
  {
    page: page(
      'fixture://table',
      'Dense Metals',
      'Symbols of three dense metals. Tungsten W. Osmium Os. Iridium Ir.',
    ),
    query: 'chemical symbol of osmium',
  },
  {
    page: page(
      'fixture://js',
      'Client Rendered',
      'Rendered by script: the launch code is AURORA-7.',
    ),
    query: 'what is the launch code',
  },
]

const corpus = (): IndexedPage[] => {
  const pages = Array.from({ length: DOCS }, (_, i) =>
    page(`synthetic://${i}`, sentence(6), sentence(250)),
  )
  for (const [i, p] of planted.entries()) pages.splice(Math.floor((DOCS * (i + 1)) / 4), 0, p.page)
  return pages
}

const pct = (sorted: number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0
const mb = (bytes: number) => Math.round(bytes / 1e5) / 10
const timed = <A, E>(eff: Effect.Effect<A, E>) =>
  Effect.gen(function* () {
    const start = yield* Clock.currentTimeNanos
    const value = yield* eff
    return { value, ms: Number((yield* Clock.currentTimeNanos) - start) / 1e6 }
  })

const queryLatencies = (index: LocalIndex) =>
  Effect.forEach(
    Array.from({ length: 300 }, () => `${word()} ${word()} ${word()}`),
    (q) => Effect.map(timed(searchLocal(index, q, 10)), (r) => r.ms),
    { concurrency: 1 },
  ).pipe(Effect.map((t) => t.sort((a, b) => a - b)))

const recallAt5 = (index: LocalIndex) =>
  Effect.forEach(planted, (p) => searchLocal(index, p.query, 5), { concurrency: 1 }).pipe(
    Effect.map(
      (found) =>
        found.filter((hits, i) => hits.some((h) => h.url === planted[i]?.page.url)).length /
        planted.length,
    ),
  )

const program = Effect.gen(function* () {
  const pages = corpus()
  const before = process.memoryUsage()
  const index = yield* openLocalIndex(':memory:')
  const build = yield* timed(addPages(index, pages))
  const after = process.memoryUsage()
  const times = yield* queryLatencies(index)
  yield* Console.log(
    JSON.stringify({
      docs: pages.length,
      ...build.value,
      buildMs: Math.round(build.ms),
      docsPerSec: Math.round(pages.length / (build.ms / 1000)),
      rssDeltaMB: mb(after.rss - before.rss),
      heapDeltaMB: mb(after.heapUsed - before.heapUsed),
      queryP50Ms: +pct(times, 0.5).toFixed(2),
      queryP95Ms: +pct(times, 0.95).toFixed(2),
      recallAt5: yield* recallAt5(index),
    }),
  )
})

Effect.runFork(Effect.scoped(program))
