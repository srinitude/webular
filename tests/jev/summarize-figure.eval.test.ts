// Eval: the summarize image arm against the text-only summary, offline. Each
// case carries a page and a recorded image.router answer for the summarize
// question. Prints pass rate for both arms; the image arm must hold every
// text win and cite the figure where the page's key facts sit in a picture.
import { afterAll, expect, test } from 'bun:test'
import { Console, Effect, Layer, ManagedRuntime, Ref } from 'effect'
import type { PageImage } from '../../src/lib/html-images.ts'
import { Jev, type JevResult } from '../../src/lib/jev/client.ts'
import { sourceFigures } from '../../src/lib/router-images.ts'
import { sentenceSpans } from '../../src/lib/summarize-rank.ts'
import { result, SUMMARY_QUESTION } from '../../src/workflows/summarize.ts'
import cases from './candidates/summarize.figure.json'

type Gold = { kind: 'text'; fact: string } | { kind: 'figure'; src: string }
type Case = {
  id: string
  page: { url: string; text: string; images: PageImage[] }
  router: { choice: string; confidence: number } | null
  gold: Gold
}
const all = [...cases['baseline-wins'], ...cases['baseline-loses']] as ReadonlyArray<Case>

// Recorded router answers; a case with no recording must not call Jev.
const recorded = (c: Case) =>
  Layer.succeed(Jev)(
    Jev.of({
      available: true,
      ask: () =>
        c.router === null
          ? Effect.die(`no Jev call expected for ${c.id}`)
          : Effect.succeed({
              answers: { route: c.router, route_swapped: c.router },
            } as unknown as JevResult),
    }),
  )

const summaryOf = (c: Case, figures: string[]) =>
  result({
    text: c.page.text,
    sentences: 2,
    source_url: c.page.url,
    figures,
    all: sentenceSpans(c.page.text),
  }).summary
const correct = (gold: Gold, summary: string) =>
  summary.includes(gold.kind === 'text' ? gold.fact : gold.src)

const textArm = (c: Case) => correct(c.gold, summaryOf(c, []))
const imageArm = (c: Case) =>
  sourceFigures({ question: SUMMARY_QUESTION, ...c.page }).pipe(
    Effect.provide(recorded(c)),
    Effect.map((figures) => correct(c.gold, summaryOf(c, figures))),
  )
const rate = (rows: ReadonlyArray<boolean>) => rows.filter(Boolean).length / rows.length

test('the text arm passes every baseline-wins case and fails every baseline-loses case', () => {
  for (const c of cases['baseline-wins'] as ReadonlyArray<Case>) expect(textArm(c)).toBe(true)
  for (const c of cases['baseline-loses'] as ReadonlyArray<Case>) expect(textArm(c)).toBe(false)
})

test('the image arm passes every case', () =>
  Effect.runPromise(
    Effect.forEach(all, imageArm, { concurrency: 4 }).pipe(
      Effect.map((rows) => ({ before: rate(all.map(textArm)), after: rate(rows) })),
      Effect.tap((r) =>
        Console.log(JSON.stringify({ eval: 'summarize.figure', cases: all.length, ...r })),
      ),
      Effect.tap(({ before, after }) =>
        Effect.sync(() => {
          expect(after).toBeGreaterThanOrEqual(before)
          expect(after).toBe(1)
        }),
      ),
    ),
  ))

// Live keep run (WEBULAR_TEST_LIVE=1): the real image.router on every case, 3
// runs. Prints pass rates and router input tokens per page, so the keep rule
// can weigh the router's cost against the summary call it rescues.
const RUNS = 3
const rt = ManagedRuntime.make(Jev.live)
afterAll(() => rt.dispose())
const liveRun = Effect.gen(function* () {
  const jev = yield* Jev
  if (!jev.available) return
  const tokens = yield* Ref.make(0)
  const counted = Jev.of({
    available: true,
    ask: (name, req) =>
      jev.ask(name, req).pipe(Effect.tap((r) => Ref.update(tokens, (n) => n + r.inputTokens))),
  })
  const runs = yield* Effect.forEach(
    Array.from({ length: RUNS }),
    () =>
      Effect.forEach(
        all,
        (c) =>
          sourceFigures({ question: SUMMARY_QUESTION, ...c.page }).pipe(
            Effect.provideService(Jev, counted),
            Effect.map((figures) => correct(c.gold, summaryOf(c, figures))),
          ),
        { concurrency: 4 },
      ),
    { concurrency: 1 },
  )
  const before = rate(all.map(textArm))
  const after = runs.map(rate)
  const routerTokensPerPage = (yield* Ref.get(tokens)) / (RUNS * all.length)
  yield* Console.log(
    JSON.stringify({ eval: 'summarize.figure.live', before, after, routerTokensPerPage }),
  )
  for (const a of after) expect(a).toBeGreaterThanOrEqual(before)
})

test.if(process.env['WEBULAR_TEST_LIVE'] === '1')(
  'live: the image arm holds or beats the text arm',
  () => rt.runPromise(liveRun),
  120_000,
)
