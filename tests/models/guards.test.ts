// Guard rules 26 to 31: the recorded dry-run fixture keeps every rule, and a
// record that breaks one rule makes exactly that rule report a problem.
import { expect, test } from 'bun:test'
import { Schema } from 'effect'
import recorded from './fixtures/tracks/dry-run.json'
import { type TrackRecord as Rec, TrackRecord } from './guards.ts'
import { claudeArgs } from './run.ts'
import type { Surface } from './scenarios.ts'
import { armStats, guardProblems } from './tracks-dry-run.ts'

const fixture = Schema.decodeUnknownSync(TrackRecord)(recorded)

const broken = (t: Rec) =>
  Object.entries(guardProblems(t))
    .filter(([, p]) => p.length > 0)
    .map(([rule]) => rule)

test('the recorded dry run keeps guard rules 26 to 31', () => {
  expect(broken(fixture)).toEqual([])
})

const mutations: [string, (t: Rec) => Rec][] = [
  [
    'three models ran',
    (t) => ({ ...t, rows: t.rows.filter((r) => r.model !== 'claude-haiku-5-5') }),
  ],
  [
    'one web tool per arm',
    (t) => ({
      ...t,
      arms: t.arms.map((a, i) => (i ? a : { ...a, args: ['--allowedTools', 'WebFetch'] })),
    }),
  ],
  [
    'same arm conditions',
    (t) => ({ ...t, rows: t.rows.map((r, i) => (i ? r : { ...r, maxTurns: 99 })) }),
  ],
  [
    'run records complete',
    (t) => ({ ...t, rows: t.rows.map((r, i) => (i ? r : { ...r, inputTokens: null })) }),
  ],
  [
    'grader cross-check',
    (t) => ({ ...t, rubrics: t.rubrics.map((g) => ({ ...g, headlineJudge: 'claude-opus-5-5' })) }),
  ],
  ['human audit', (t) => ({ ...t, audit: t.audit.slice(1) })],
]

test.each(mutations)('breaking "%s" fails only that guard', (rule, mutate) => {
  expect(broken(mutate(fixture))).toEqual([rule])
})

test('wrapper descriptions more than 10% apart break the same-conditions guard', () => {
  const first = fixture.arms.findIndex((a) => a.description)
  const arms = fixture.arms.map((a, i) =>
    i === first ? { ...a, description: `${a.description}${a.description}` } : a,
  )
  expect(broken({ ...fixture, arms })).toEqual(['same arm conditions'])
})

// Guard 27 reads the flags the runner really passes to `claude -p`.
test('guard 27 holds on the real claudeArgs of every arm, and breaks without --disallowedTools', () => {
  const s = {
    id: 'x',
    intent: '',
    outcome: '',
    eval: { kind: 'code' as const },
    tool: 'scrape',
    prompt: 'p',
    reference: [],
  }
  const ctx = { origin: 'http://o', tmp: 't' }
  const surfaces: [Surface, string][] = [
    ['cli', 'webular'],
    ['mcp', 'webular'],
    ['plugin', 'webular'],
    ['peer', 'firecrawl'],
  ]
  const arms = surfaces.map(([surface, provider]) => ({
    surface,
    provider,
    args: claudeArgs(s, 'claude-haiku-5-5', surface, ctx, 'mcp.json', 10, provider),
  }))
  const rule = (a: Rec['arms']) => guardProblems({ ...fixture, arms: a })['one web tool per arm']
  expect(rule(arms)).toEqual([])
  const open = arms.map((a) => ({
    ...a,
    args: a.args.slice(0, a.args.indexOf('--disallowedTools')),
  }))
  expect(rule(open)).toHaveLength(arms.length * 2)
})

test('arm stats give pass^k over repeats and cost per correct answer', () => {
  const rows = fixture.rows.filter((r) => r.model === 'claude-opus-5-5' && r.provider === 'exa')
  const s = armStats(rows)
  expect([s.n, s.passRate, s.passK, s.costPerCorrect]).toEqual([
    3,
    2 / 3,
    1 / 2,
    (0.043 + 0.042 + 0.031) / 2,
  ])
})
