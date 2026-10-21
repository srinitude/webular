// Grader track checks: kappa on textbook values, blinding, order swaps,
// verdict parsing, judge flags, and the offline cross-check on the fixtures.
import { expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Effect, Option } from 'effect'
import { ROOT } from '../../_support/root.ts'
import { blind, bothOrders } from './blind.ts'
import { crossCheck } from './cross-check.ts'
import { judgeArgs, parseVerdict } from './judge.ts'
import { cohen, fleiss } from './kappa.ts'

const repeat = (label: string, n: number) => Array.from({ length: n }, () => label)

test("Cohen's kappa matches the textbook 50-item example (0.4)", () => {
  // A said yes 25 times, B 30 times; 20 yes-yes, 15 no-no.
  const a = [...repeat('y', 20), ...repeat('y', 5), ...repeat('n', 10), ...repeat('n', 15)]
  const b = [...repeat('y', 20), ...repeat('n', 5), ...repeat('y', 10), ...repeat('n', 15)]
  expect(cohen(a, b)).toBeCloseTo(0.4, 6)
  expect(cohen(['p', 'f'], ['p', 'f'])).toBe(1)
})

test("Fleiss' kappa matches the textbook 10-item, 14-rater example (0.210)", () => {
  const counts = [
    [0, 0, 0, 0, 14],
    [0, 2, 6, 4, 2],
    [0, 0, 3, 5, 6],
    [0, 3, 9, 2, 0],
    [2, 2, 8, 1, 1],
    [7, 7, 0, 0, 0],
    [3, 2, 6, 3, 0],
    [2, 5, 3, 2, 2],
    [6, 5, 2, 1, 0],
    [0, 2, 2, 3, 7],
  ]
  const rows = counts.map((row) => row.flatMap((n, c) => repeat(String(c), n)))
  expect(fleiss(rows)).toBeCloseTo(0.20993, 4)
})

test('blind strips brands, tool names, and URLs that name a tool, then caps length', () => {
  const out = blind('Exa said (https://exa.ai/x) via mcp__webular__search; see https://nasa.gov/a')
  expect(out).toBe('[tool] said ([link]) via [tool]; see https://nasa.gov/a')
  expect(blind('x'.repeat(50), 10)).toHaveLength(10)
})

test('bothOrders keeps a verdict only when it holds in both orders', () => {
  const answers = ['short', 'a longer answer']
  const longest = (xs: readonly string[]) =>
    Effect.succeed(xs.findIndex((x) => x.length === Math.max(...xs.map((y) => y.length))))
  const firstAlways = () => Effect.succeed(0)
  expect(Effect.runSync(bothOrders(answers, longest))).toEqual(Option.some(1))
  expect(Effect.runSync(bothOrders(answers, firstAlways))).toEqual(Option.none())
})

test('judge reads the last PASS or FAIL and runs with no tools and no web', () => {
  expect(parseVerdict('Thinking... FAIL? no. PASS')).toBe('pass')
  expect(parseVerdict('nothing here')).toBeUndefined()
  const args = judgeArgs('claude-haiku-5-5', 'r', 't', 'a')
  expect(args[args.indexOf('--tools') + 1]).toBe('')
  expect(args[args.indexOf('--disallowedTools') + 1]).toBe('WebSearch,WebFetch')
})

test('offline cross-check gives kappa numbers from the recorded fixture', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const s = yield* crossCheck(`${ROOT}tests/models/grader/fixtures/recorded.json`)
      expect(s.graders).toHaveLength(3)
      for (const r of s.graders) {
        expect(Number.isFinite(r.cohenKappa)).toBe(true)
        expect(Number.isFinite(r.selfPreferenceGap)).toBe(true)
        expect(r.setsHeadline).toBe(false)
      }
      expect(Number.isFinite(s.fleissKappa)).toBe(true)
    }).pipe(Effect.provide(BunServices.layer)),
  ))
