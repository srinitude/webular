// Scaling benchmark for the summarizer hot path at 10, 1,000 and 100,000
// sentences: prints wall time per size and the process's peak RSS. Run with
// `mise run bench`; an argument limits the run to one size.
import { Console, Effect, Layer, ManagedRuntime } from 'effect'
import { summarizeText } from '../../src/lib/summarize.ts'

const WORDS = ['alpha', 'beta', 'gamma', 'delta', 'web', 'page', 'link', 'crawl', 'source', 'map']
const sentence = (i: number): string =>
  `Sentence ${i} has ${WORDS[i % 10]} and ${WORDS[(i * 7) % 10]} words about ${WORDS[(i * 3) % 10]}.`
const sizes = Bun.argv[2] ? [Number(Bun.argv[2])] : [10, 1_000, 100_000]

const timeOne = (n: number) =>
  Effect.gen(function* () {
    const text = Array.from({ length: n }, (_, i) => sentence(i)).join(' ')
    const start = Bun.nanoseconds()
    summarizeText(text, 5)
    yield* Console.log(`summarize n=${n}: ${((Bun.nanoseconds() - start) / 1e6).toFixed(2)} ms`)
  })

// Sizes run one at a time so each timing owns the CPU.
const main = Effect.gen(function* () {
  yield* Effect.forEach(sizes, timeOne, { concurrency: 1, discard: true })
  yield* Console.log(`peak RSS: ${(process.resourceUsage().maxRSS / 1024).toFixed(1)} MiB`)
})

ManagedRuntime.make(Layer.empty).runFork(main)
