// Scaling benchmark for the hot paths at 10, 1,000 and 100,000 items: prints
// wall time per case and size, then the process's peak RSS. Cases: summarize
// (sentences), dedupe (map links), linksFrom (anchors on one page), crawl
// (titleAndLinks with and without the anchor scan, per page CPU), download
// (1 KiB chunks from a local server). Run with `mise run bench`; an argument
// limits the run to one size.
import * as BunServices from '@effect/platform-bun/BunServices'
import { Console, Effect, FileSystem, ManagedRuntime } from 'effect'
import { downloadToFile } from '../../src/lib/download.ts'
import { titleAndLinks } from '../../src/lib/html.ts'
import { summarizeText } from '../../src/lib/summarize.ts'
import { dedupe } from '../../src/workflows/map.ts'

const WORDS = ['alpha', 'beta', 'gamma', 'delta', 'web', 'page', 'link', 'crawl', 'source', 'map']
const sentence = (i: number): string =>
  `Sentence ${i} has ${WORDS[i % 10]} and ${WORDS[(i * 7) % 10]} words about ${WORDS[(i * 3) % 10]}.`
const sizes = Bun.argv[2] ? [Number(Bun.argv[2])] : [10, 1_000, 100_000]

const BASE = 'https://example.com/'
const DEDUPE_LIMIT = 500
const CHUNK = new Uint8Array(1024)

// n links, about 10% repeats of earlier ones (index modulo 90% of n).
const links = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => `${BASE}p/${i % Math.max(1, Math.ceil(n * 0.9))}`)

const page = (n: number): string =>
  `<html><head><title>t</title></head><body>${Array.from({ length: n }, (_, i) => `<a href="/p/${i}">l</a>`).join('')}</body></html>`

// Streams n 1 KiB chunks, one per pull, then closes.
const chunkResponse = (n: number): Response => {
  let sent = 0
  return new Response(
    new ReadableStream<Uint8Array>({
      pull: (controller) => {
        if (sent++ < n) controller.enqueue(CHUNK)
        else controller.close()
      },
    }),
  )
}

// A local server that streams n chunks; it stops with the scope.
const chunkServer = (n: number) =>
  Effect.acquireRelease(
    Effect.sync(() => Bun.serve({ port: 0, maxRequestBodySize: 1, fetch: () => chunkResponse(n) })),
    (server) => Effect.promise(() => server.stop(true)),
  )

// Prints elapsed wall time of `run` as `<label> n=<n>: <ms> ms`.
const timed = <A, E, R>(label: string, n: number, run: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const start = Bun.nanoseconds()
    yield* run
    yield* Console.log(`${label} n=${n}: ${((Bun.nanoseconds() - start) / 1e6).toFixed(2)} ms`)
  })

const summarizeCase = (n: number) => {
  const text = Array.from({ length: n }, (_, i) => sentence(i)).join(' ')
  return timed(
    'summarize',
    n,
    Effect.sync(() => summarizeText(text, 5)),
  )
}

const dedupeCase = (n: number) => {
  const input = links(n)
  return timed(
    'dedupe',
    n,
    Effect.sync(() => dedupe(input, DEDUPE_LIMIT)),
  )
}

// linksFrom is private to html.ts; titleAndLinks with links on is the entry.
// crawl exports no pure fold, so its per-page CPU is the same call with the
// anchor scan on versus off (the last crawl level skips it).
const htmlCases = (n: number) => {
  const html = page(n)
  const parse = (label: string, withLinks: boolean) =>
    timed(
      label,
      n,
      Effect.sync(() => titleAndLinks(html, BASE, withLinks)),
    )
  return Effect.all(
    [
      parse('linksFrom', true),
      parse('crawl withLinks=true', true),
      parse('crawl withLinks=false', false),
    ],
    { discard: true },
  )
}

// The temp file and its folder go with the scope; the download renames onto it.
const downloadCase = (n: number) =>
  Effect.scoped(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const dest = yield* fs.makeTempFileScoped({ prefix: 'webular-bench-', suffix: '.bin' })
      const server = yield* chunkServer(n)
      yield* timed('download', n, downloadToFile(`http://localhost:${server.port}/`, dest))
    }),
  )

// Cases and sizes run one at a time so each timing owns the CPU.
const cases = [summarizeCase, dedupeCase, htmlCases, downloadCase]
const timeOne = (n: number) =>
  Effect.forEach(cases, (run) => run(n), { concurrency: 1, discard: true })

const main = Effect.gen(function* () {
  yield* Effect.forEach(sizes, timeOne, { concurrency: 1, discard: true })
  yield* Console.log(`peak RSS: ${(process.resourceUsage().maxRSS / 1024).toFixed(1)} MiB`)
})

ManagedRuntime.make(BunServices.layer).runFork(main)
