// BATCH accuracy eval: a small gold set of fixture URLs (distinct titles, an
// entity title, a 404, a 500, a duplicate) scored per URL. Gold comes from the
// fixture design: each page's title is what the page declares. Same input twice
// must give identical output; order follows the input, duplicates included.
import { describe, expect, test } from 'bun:test'
import { Effect, Schema } from 'effect'
import { runCli } from '../_support/cli.ts'
import { useFixture } from '../_support/fixture.ts'
import { eff } from '../_support/run.ts'

const PAGES: Record<string, string> = {
  '/p/alpha': 'Alpha Report',
  '/p/entity': 'Fish &amp; Chips Guide',
  '/p/unicode': 'Café Münchën',
  '/p/spaced': 'Spaced Out Title',
  '/p/long': 'Quarterly Review of Everything',
}
const page = (title: string) => () =>
  new Response(
    `<!doctype html><html><head><title>${title}</title></head><body><h1>${title}</h1><p>Deterministic accuracy fixture body for ${title}. It carries enough prose for readability extraction to keep the page.</p></body></html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8' } },
  )

const fx = useFixture(() => ({
  ...Object.fromEntries(Object.entries(PAGES).map(([p, t]) => [p, page(t)])),
  '/boom': () => new Response('server error', { status: 500 }),
}))

// Input order is the gold order; the duplicate and the two failures are on purpose.
const INPUT = [
  '/p/alpha',
  '/p/entity',
  '/missing',
  '/p/unicode',
  '/p/alpha',
  '/boom',
  '/p/spaced',
  '/p/long',
]
const GOLD_TITLE: Record<string, string> = {
  '/p/alpha': 'Alpha Report',
  '/p/entity': 'Fish & Chips Guide',
  '/p/unicode': 'Café Münchën',
  '/p/spaced': 'Spaced Out Title',
  '/p/long': 'Quarterly Review of Everything',
}

const Result = Schema.Struct({
  url: Schema.String,
  ok: Schema.Boolean,
  title: Schema.optional(Schema.String),
  error: Schema.optional(Schema.String),
})
const decodeBatch = Schema.decodeUnknownEffect(
  Schema.fromJsonString(Schema.Struct({ count: Schema.Number, results: Schema.Array(Result) })),
)

// A gold page must come back ok with its exact title; any other URL must fail with an error.
const verdict = (path: string, r: typeof Result.Type | undefined) => {
  const want = GOLD_TITLE[path]
  const good = want
    ? r?.ok === true && r.title === want
    : r?.ok === false && typeof r.error === 'string' && r.error.length > 0
  return { path, good, got: JSON.stringify(r) }
}

const runBatch = (concurrency: string) =>
  runCli('src/commands/batch.ts', [
    '--urls',
    INPUT.map((p) => `${fx.origin}${p}`).join(','),
    '--concurrency',
    concurrency,
    '--json',
  ])

describe('webular batch — accuracy against a gold URL set', () => {
  test(
    'per-URL pass rate, input order, and determinism',
    eff(
      Effect.gen(function* () {
        const first = yield* runBatch('4')
        const second = yield* runBatch('1')
        // Partial success exits 3; the shape is the contract under test.
        expect(first.code).toBe(3)
        expect(second.code).toBe(3)
        const { count, results } = yield* decodeBatch(first.out)
        expect(count).toBe(INPUT.length)
        expect(results.map((r) => r.url)).toEqual(INPUT.map((p) => `${fx.origin}${p}`))

        const verdicts = INPUT.map((path, i) => verdict(path, results[i]))
        yield* Effect.forEach(
          verdicts.filter((v) => !v.good),
          (v) => Effect.logInfo(`batch-accuracy MISS ${v.path} got=${v.got}`),
          { concurrency: 1 },
        )
        const passed = verdicts.filter((v) => v.good).length
        const rate = passed / INPUT.length
        const same = first.out === second.out
        yield* Effect.logInfo(
          `batch-accuracy pass_rate=${rate.toFixed(3)} (${passed}/${INPUT.length}) deterministic_across_concurrency=${same}`,
        )
        expect(rate).toBe(1)
        expect(same).toBe(true)
      }),
    ),
    120_000,
  )
})
