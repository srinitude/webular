// Guard tests 19-24 (spec-integrity-and-report.md): each guard fails on its
// bias and passes the clean case, plus known values for the statistics.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { checkClaims, checkStatsPresent } from '../../scripts/bench/claims.ts'
import * as G from '../../scripts/bench/grade.ts'
import * as J from '../../scripts/bench/judge.ts'
import type { Comparison, Row, Status, Task } from '../../scripts/bench/schema.ts'
import * as S from '../../scripts/bench/stats.ts'
import { eff, failMsg } from '../_support/run.ts'

const tags = { domain: 'd', language: 'en', fresh: false, longTail: false, navigational: false }
const task = (over: Partial<Task> = {}): Task => ({
  ...{ id: 't1', family: 'answer.short', split: 'dev', input: 'q', source: 's' },
  ...{ asOf: '2026-01-01', buildDate: '2026-01-01', author: 'a', questionType: 'fact' },
  ...{ aliases: [], checks: [] },
  tags: { ...tags, premise: 'none' },
  ...over,
})
const key = { provider: 'webular', taskId: 't1', run: 0, commit: 'c', settingsHash: 'h', date: 'd' }
const row = (status: Status, output = 'x', latencyMs = 100): Row => ({
  ...{ key, family: 'answer.short', round: 'r', settings: 'default', phase: 'cold', query: 'q' },
  ...{ requestBody: '{}', output, status, latencyMs, cached: false, loadAvg: 0, cpuMs: 0 },
  calls: [],
})
const off = { errA: false, errB: false }
const pair = (a: number, b: number): S.Pair => ({ a, b, ...off })

test('deterministic checks normalize text, URLs, aliases, and numbers', () => {
  expect(G.normalizeText('  Café-Crème, ÉTÉ! ')).toBe('cafe creme ete')
  const url = { kind: 'urlMatches', value: 'https://example.com/a' } as const
  expect(G.runCheck(url, 'see https://WWW.Example.com/a/?utm_source=x&gclid=1#top')).toBe(true)
  expect(G.runCheck(url, 'see https://example.com/b')).toBe(false)
  expect(G.aliasMatch('It is in Paris.', ['paris'])).toBe(true)
  expect(G.aliasMatch('A Parisian cafe', ['paris'])).toBe(false)
  expect(G.runCheck({ kind: 'numeric', value: 1200, tolerance: 5 }, 'about 1,203 m')).toBe(true)
  expect(G.runCheck({ kind: 'numeric', value: 1200, tolerance: 1 }, 'about 1,203 m')).toBe(false)
  expect(G.runCheck({ kind: 'regex', value: '(' }, '(')).toBe(false)
  expect(G.runCheck({ kind: 'excludes', value: 'no' }, 'yes')).toBe(true)
  const graded = G.gradeRow(task({ aliases: ['paris'] }), row('ok', 'Paris'), 'answer.native')
  expect(graded).toMatchObject({ pass: true, mode: 'answer.native', status: 'ok' })
})

test(
  'guard 19: answer modes are scored apart',
  eff(
    Effect.gen(function* () {
      const graded = G.ANSWER_MODES.map((m) => G.gradeRow(task(), row('ok'), m))
      expect(yield* failMsg(G.checkModesApart(graded))).toContain('pooled')
      for (const group of G.byMode(graded).values()) yield* G.checkModesApart(group)
      expect(G.byMode(graded).size).toBe(4)
    }),
  ),
)

test(
  'guard 20: an uncalibrated judge is refused, and the default judge is off',
  eff(
    Effect.gen(function* () {
      expect(J.defaultJudge).toBeUndefined()
      const judge = { model: 'pinned', judge: () => Effect.succeed('correct' as const) }
      const weak = { n: 200, kappa: 0.7, accuracy: 0.96 }
      expect(yield* failMsg(J.useJudge(judge, weak))).toContain('not calibrated')
      expect(yield* failMsg(J.useJudge(judge, { ...weak, kappa: 0.9, n: 50 }))).toContain('n 50')
      expect(yield* J.useJudge(judge, { n: 200, kappa: 0.85, accuracy: 0.97 })).toBe(judge)
      const human = ['correct', 'incorrect', 'correct', 'not_attempted'] as const
      expect(J.calibrate(human, human)).toEqual({ n: 4, kappa: 1, accuracy: 1 })
      expect(J.cohensKappa(['correct', 'incorrect'], ['incorrect', 'correct'])).toBe(-1)
    }),
  ),
)

test(
  'guard 21: judge input is blinded, swapped by seed, and capped',
  eff(
    Effect.gen(function* () {
      const tools = ['webular', 'Firecrawl']
      const answers = [
        { tool: 'webular', text: 'webular says 42' },
        { tool: 'Firecrawl', text: 'FIRECRAWL says 41 '.repeat(20) },
      ]
      const clean = J.buildJudgeInput(answers, tools, 1, 50)
      expect(clean.order).toEqual([1, 0])
      yield* J.checkJudgeInput(clean, tools)
      const named = { ...clean, texts: ['webular says 42', 'x'] }
      expect(yield* failMsg(J.checkJudgeInput(named, tools))).toContain('names tool')
      const unswapped = { ...clean, order: [0, 1] }
      expect(yield* failMsg(J.checkJudgeInput(unswapped, tools))).toContain('order')
      const long = { ...clean, texts: ['y'.repeat(51), 'x'] }
      expect(yield* failMsg(J.checkJudgeInput(long, tools))).toContain('over cap')
    }),
  ),
)

const strongPairs = (): S.Pair[] =>
  Array.from({ length: 400 }, (_, i) => pair(i % 10 < 8 ? 1 : 0, i % 10 < 4 ? 1 : 0))

test(
  'guard 22: every comparison carries n, CI, test, and Holm p',
  eff(
    Effect.gen(function* () {
      const [c] = S.finalize([
        S.draft('answer.short', 'peer', strongPairs(), { graded: false, seed: 7 }),
      ])
      expect(c).toBeDefined()
      yield* checkStatsPresent(c as Comparison)
      const { pHolm: _drop, ...missing } = c as Comparison
      expect(yield* failMsg(checkStatsPresent(missing))).toContain('missing')
      expect(
        yield* failMsg(checkStatsPresent({ ...missing, pHolm: 0.01, ci: [0, Number.NaN] })),
      ).toContain('missing')
    }),
  ),
)

const comparison = (verdict: Comparison['verdict']): Comparison => ({
  ...{ family: 'answer.short', peer: 'exa', n: 400, diff: 0.01, ci: [-0.02, 0.04] },
  ...{ test: 'exact McNemar', p: 0.3, pHolm: 0.6, verdict },
})

test(
  'guard 23: report text never overclaims',
  eff(
    Effect.gen(function* () {
      const tie = [comparison('tie')]
      expect(yield* failMsg(checkClaims('answer.short vs exa: webular wins', tie))).toContain(
        'overclaims',
      )
      expect(yield* failMsg(checkClaims('webular is slightly better', tie))).toContain(
        'slightly better',
      )
      expect(yield* failMsg(checkClaims('dimension winner: webular', tie))).toContain(
        'dimension winner',
      )
      yield* checkClaims('answer.short vs exa: tie', tie)
      yield* checkClaims('answer.short vs exa: webular wins', [comparison('win')])
    }),
  ),
)

test(
  'guard 24: error rows fail, keep their status, and stay in latency as censored',
  eff(
    Effect.gen(function* () {
      const rows = [
        row('ok', 'x', 100),
        row('timeout', '', 60_000),
        row('ok', '  ', 50),
        row('error_5xx'),
      ]
      const graded = rows.map((r) => G.gradeRow(task(), r))
      expect(graded.map((g) => g.status)).toEqual(['ok', 'timeout', 'empty', 'error_5xx'])
      expect(graded.map((g) => g.pass)).toEqual([true, false, false, false])
      const latency = G.latencySamples(rows, 60_000)
      expect(latency.filter((l) => l.censored).length).toBe(3)
      yield* G.checkErrorRows(rows, graded, latency)
      const scoredOk = graded.map((g) => ({ ...g, pass: true, status: 'ok' as const }))
      expect(yield* failMsg(G.checkErrorRows(rows, scoredOk, latency))).toContain('scored ok')
      expect(yield* failMsg(G.checkErrorRows(rows, graded, latency.slice(0, 1)))).toContain(
        'dropped',
      )
    }),
  ),
)

test('known values: McNemar, Holm, power, bootstrap, verdicts', () => {
  expect(S.mcnemarExact(10, 2)).toBeCloseTo(0.0386, 4)
  expect(S.mcnemarExact(0, 0)).toBe(1)
  const adjusted = S.holm([0.01, 0.04, 0.03])
  expect(adjusted.map((p) => Number(p.toFixed(10)))).toEqual([0.03, 0.06, 0.06])
  expect(Math.ceil(S.requiredTasks(0.2))).toBe(625)
  const pairs = strongPairs()
  expect(S.bootstrapCI(pairs, 3)).toEqual(S.bootstrapCI(pairs, 3))
  const grouped = pairs.map((p, i) => ({ ...p, group: `g${i % 20}` }))
  expect(S.bootstrapCI(grouped, 3)[0]).toBeGreaterThan(0)
  const [win] = S.finalize(
    [S.draft('answer.short', 'peer', pairs, { graded: false, seed: 1 })],
    0.1,
  )
  expect(win?.verdict).toBe('win')
  const errs = pairs.map((p, i) => ({ ...p, errA: i % 10 === 9 }))
  const [noisy] = S.finalize(
    [S.draft('answer.short', 'peer', errs, { graded: false, seed: 1 })],
    0.1,
  )
  expect(noisy?.verdict).toBe('tie')
  const graded = { graded: true, seed: 1 }
  const few = S.draft('answer.short', 'p', pairs.slice(0, 20), graded)
  expect(S.finalize([few])[0]?.verdict).toBe('not enough tasks')
  const flat = S.draft(
    'answer.short',
    'p',
    pairs.map((p) => pair(p.a, p.a)),
    graded,
  )
  expect(S.finalize([flat])[0]?.verdict).toBe('tie')
}, 60_000)
