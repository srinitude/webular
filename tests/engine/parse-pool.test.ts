// The Readability worker pool returns the same text as an in-thread parse,
// keeps input order under concurrency, and maps a parse failure to a failure.
// A batch below POOL_MIN_PAGES starts no worker; a batch at it posts to the pool.
import { describe, expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'
import { htmlToArticle } from '../../src/lib/html.ts'
import { fetchSources, ParsePool, parseArticleText } from '../../src/lib/sources.ts'
import { startFixture } from '../_support/fixture.ts'
import { defaultRoutes } from '../_support/routes.ts'
import { eff } from '../_support/run.ts'

const page = (n: number) =>
  `<!doctype html><html><head><title>Page ${n}</title></head><body><article><h1>Page ${n}</h1>${`<p>Deterministic pool body ${n} with enough prose for readability to keep it.</p>`.repeat(20)}</article></body></html>`

// Swaps the global Worker for one that counts starts, posts, and live workers,
// and puts the real one back when the test's scope closes.
const countWorkers = Effect.acquireRelease(
  Effect.sync(() => {
    const real = globalThis.Worker
    const seen = { real, started: 0, posted: 0, live: new Set<Worker>() }
    globalThis.Worker = class extends real {
      constructor(...args: ConstructorParameters<typeof Worker>) {
        super(...args)
        seen.started++
        seen.live.add(this)
      }
      override postMessage(message: unknown) {
        seen.posted++
        super.postMessage(message)
      }
      override terminate() {
        seen.live.delete(this)
        super.terminate()
      }
    }
    return seen
  }),
  (seen) =>
    Effect.sync(() => {
      globalThis.Worker = seen.real
    }),
)

const batch = (n: number) =>
  Effect.gen(function* () {
    const fx = yield* startFixture(defaultRoutes)
    const urls = ['/a', '/b', '/c', '/d', '/e'].slice(0, n)
    return yield* fetchSources(urls.map((p) => ({ title: p, url: `${fx.origin}${p}` })))
  })

// Runs first, so no earlier parse in this file has warmed a worker.
describe('fetchSources — pool cut at POOL_MIN_PAGES', () => {
  test(
    'a 3-page batch parses in-thread and starts no worker',
    eff(
      Effect.gen(function* () {
        const seen = yield* countWorkers
        const { entries } = yield* batch(3)
        expect(entries).toHaveLength(3)
        expect(seen.started).toBe(0)
        expect(seen.posted).toBe(0)
      }),
    ),
    15_000,
  )

  test(
    'a 4-page batch parses on the pool',
    eff(
      Effect.gen(function* () {
        const seen = yield* countWorkers
        const { entries } = yield* batch(4)
        expect(entries.map((e) => e.text.length > 0)).toEqual([true, true, true, true])
        expect(seen.posted).toBe(4)
      }),
    ),
    15_000,
  )
})

describe('ParsePool — lifecycle', () => {
  test(
    'closing the pool layer ends its workers',
    eff(
      Effect.gen(function* () {
        const seen = yield* countWorkers
        yield* batch(4).pipe(Effect.provide(Layer.fresh(ParsePool.layer)))
        expect(seen.started).toBeGreaterThan(0)
        expect(seen.live.size).toBe(0)
      }),
    ),
    15_000,
  )
})

describe('parseArticleText — worker pool', () => {
  test(
    'matches the in-thread parse, in input order, over more pages than workers',
    eff(
      Effect.gen(function* () {
        const pages = Array.from({ length: 9 }, (_, i) => page(i))
        const parsed = yield* Effect.forEach(pages, (html) => parseArticleText(html), {
          concurrency: 'unbounded',
        })
        const texts = parsed.map((p) => p.text)
        expect(texts).toEqual(pages.map((html) => htmlToArticle(html).text))
        expect(texts[3]).toContain('Deterministic pool body 3')
      }),
    ),
    15_000,
  )
})
