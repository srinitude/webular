// Eval: research lists a source's chart or table figures only when the image
// router says the answer sits in a picture. Offline: recorded router answers
// through a stub Jev layer, no network. The text-only arm (no figures, the
// report without the router) is the baseline. Prints pass rate and sure-but-wrong.

import { expect, test } from 'bun:test'
import assert from 'node:assert/strict'
import { Console, Effect, Layer } from 'effect'
import { Jev, type JevResult } from '../../src/lib/jev/client.ts'
import { CONFIDENCE_BAR } from '../../src/lib/jev/payload/index.ts'
import { type FigureInput, sourceFigures } from '../../src/lib/router-images.ts'

const img = (src: string, alt = '', caption = '') => ({
  src,
  alt,
  caption,
  srcset: '',
  width: '800',
  height: '500',
})
const LOGO = img('https://ex.org/static/logo.svg', 'Example logo')
type Case = { id: string; input: FigureInput; route: string; conf: number; gold: string[] }
const mk = (
  id: string,
  input: Omit<FigureInput, 'url'>,
  route: string,
  conf: number,
  gold: string[],
): Case => ({ id, input: { ...input, url: `https://ex.org/${id}` }, route, conf, gold })

// The fact is in the words: no figure should be listed.
const wins: ReadonlyArray<Case> = [
  mk(
    'solar-share-text',
    {
      question: 'What share of US power came from solar?',
      text: 'Solar supplied 6% of US electricity generation in 2025, up from 4%.',
      images: [LOGO, img('https://ex.org/img/solar-chart.png', 'Solar growth chart')],
    },
    'text',
    0.99,
    [],
  ),
  mk(
    'ceo-name-text',
    {
      question: 'Who is the CEO of Acme?',
      text: 'Acme named Dana Ruiz chief executive officer in March.',
      images: [img('https://ex.org/img/revenue-chart.png', 'Revenue chart')],
    },
    'text',
    0.98,
    [],
  ),
  mk(
    'no-images',
    {
      question: 'When did the bridge open?',
      text: 'The bridge opened to traffic in 1937.',
      images: [],
    },
    'text',
    0,
    [],
  ), // no Jev call
  // Jev unsure: the router falls back to its image arm and lists the chart, a known cost.
  mk(
    'unsure-falls-back',
    {
      question: 'What year was the museum founded?',
      text: 'The museum was founded in 1902 and moved in 1960.',
      images: [img('https://ex.org/img/visitors-chart.png', 'Visitors chart')],
    },
    'text',
    0.6,
    [],
  ),
]
// The fact is only in a figure: the report must list that figure.
const loses: ReadonlyArray<Case> = [
  mk(
    'gdp-chart-only',
    {
      question: 'What was the GDP growth rate in Q3?',
      text: 'The chart below shows quarterly GDP growth for the past two years.',
      images: [LOGO, img('https://ex.org/img/gdp-chart.png', '', 'Quarterly GDP growth')],
    },
    'image',
    0.99,
    ['https://ex.org/img/gdp-chart.png'],
  ),
  mk(
    'price-table-only',
    {
      question: 'How much does the Pro plan cost per month?',
      text: 'Compare our plans in the pricing table.',
      images: [img('https://ex.org/img/pricing-table.png', 'Pricing table')],
    },
    'image',
    0.97,
    ['https://ex.org/img/pricing-table.png'],
  ),
  mk(
    'rainfall-both',
    {
      question: 'How much rain fell in July, and was it a record?',
      text: 'July set a rainfall record. Monthly totals are in the figure.',
      images: [img('https://ex.org/img/fig2-rainfall.png', 'Monthly rainfall')],
    },
    'both',
    0.96,
    ['https://ex.org/img/fig2-rainfall.png'],
  ),
]
const all = [...wins, ...loses]

// A recorded router answer: both option orders agree on the case's route.
const recorded = (c: Case) =>
  Layer.succeed(Jev)(
    Jev.of({
      available: true,
      ask: () =>
        Effect.succeed({
          answers: {
            route: { choice: c.route, confidence: c.conf },
            route_swapped: { choice: c.route, confidence: c.conf },
          },
        } as unknown as JevResult),
    }),
  )

const srcs = (lines: ReadonlyArray<string>) => lines.map((l) => l.slice(l.lastIndexOf('(') + 1, -1))
const same = (a: ReadonlyArray<string>, b: ReadonlyArray<string>) => a.join() === b.join()

// Sure-but-wrong counts only Jev picks at the bar; the baseline asks Jev nothing.
const score = (arm: (c: Case) => Effect.Effect<string[]>, asksJev: boolean) =>
  Effect.map(Effect.forEach(all, arm, { concurrency: 1 }), (lists) => {
    const rows = all.map((c, i) => ({
      ok: same(srcs(lists[i] ?? []), c.gold),
      sure: asksJev && c.conf >= CONFIDENCE_BAR,
    }))
    return {
      pass: rows.filter((r) => r.ok).length / rows.length,
      sureWrong: rows.filter((r) => r.sure && !r.ok).length,
    }
  })
const baselineArm = (_c: Case) => Effect.succeed<string[]>([])
const routerArm = (c: Case) => sourceFigures(c.input).pipe(Effect.provide(recorded(c)))

test('the text-only baseline passes every baseline-wins case and fails every baseline-loses case', () => {
  for (const c of wins) expect(c.gold).toEqual([])
  for (const c of loses) expect(c.gold.length).toBeGreaterThan(0)
})

test('the router arm holds or beats the text-only baseline, with no more sure-but-wrong', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const before = yield* score(baselineArm, false)
      const after = yield* score(routerArm, true)
      yield* Console.log(
        JSON.stringify({ eval: 'research.figures', cases: all.length, before, after }),
      )
      expect(after.pass).toBeGreaterThanOrEqual(before.pass)
      expect(after.sureWrong).toBeLessThanOrEqual(before.sureWrong)
    }),
  ))

test('zero images skips Jev', () => {
  const win = wins[2]
  assert.ok(win)
  return Effect.runPromise(
    sourceFigures(win.input).pipe(
      Effect.provide(
        Layer.succeed(Jev)(Jev.of({ available: true, ask: () => Effect.die('no call') })),
      ),
      Effect.map((lines) => expect(lines).toEqual([])),
    ),
  )
})
