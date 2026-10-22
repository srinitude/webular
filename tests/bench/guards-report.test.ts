// Guard tests 15, 17, 18, 25 and the report shape: each planted bias is
// caught, and the clean case passes.
import { expect, test } from 'bun:test'
import { Effect, FileSystem, Path } from 'effect'
import { costPerCorrect, costViolations, JEV_HOST, tokenCall } from '../../scripts/bench/cost.ts'
import { reportMarkdown, writeReport } from '../../scripts/bench/report.ts'
import { type FamilyResult, headline, type ReportInput } from '../../scripts/bench/report-parts.ts'
import type { OutboundCall, Row } from '../../scripts/bench/schema.ts'
import { scanFiles, scanSecrets } from '../../scripts/bench/secrets.ts'
import { eff, tmpDir } from '../_support/run.ts'

const priced = { priceSource: 'https://typesafe.ai/pricing', priceDate: '2026-10-21' }
const jev: OutboundCall = { host: JEV_HOST, kind: 'jev', bytes: 200, usd: 0.0001, ...priced }
const search: OutboundCall = {
  host: 'search.test',
  kind: 'search',
  bytes: 900,
  usd: 0.002,
  ...priced,
}

const row = (provider: string, calls: OutboundCall[], over: Partial<Row> = {}): Row => ({
  key: { provider, taskId: 't1', run: 1, commit: 'abc', settingsHash: 'h', date: '2026-10-21' },
  family: 'answer.short',
  round: 'r1',
  settings: 'default',
  phase: 'cold',
  query: 'q',
  requestBody: '{}',
  output: 'a',
  status: 'ok',
  latencyMs: 100,
  cached: false,
  loadAvg: 1,
  cpuMs: 5,
  calls,
  ...over,
})

const result = (tool: string, score: number | null, webularOnly = false): FamilyResult => ({
  family: webularOnly ? 'feed.items' : 'answer.short',
  tool,
  n: 120,
  score,
  ci: score === null ? null : [score - 0.05, score + 0.05],
  errorRate: 0.01,
  costPerCorrect: 0.01,
  webularOnly,
})

const input = (results: FamilyResult[]): ReportInput => ({
  header: {
    setVersion: 's1',
    roundId: 'r1',
    date: '2026-10-21',
    commit: 'abc',
    judgeModel: 'judge',
    region: 'us-east',
    tools: [{ name: 'webular', version: '1', settingsHash: 'h' }],
  },
  results,
  answerSplit: [],
  rows: [
    row('webular', [jev, search]),
    row('webular', [jev], { phase: 'warm', latencyMs: 10, cached: true }),
    row('peer', [search], { status: 'timeout' }),
  ],
  correct: { webular: 2 },
  slices: [],
  publicPrivate: [{ family: 'answer.short', tool: 'webular', pub: 0.9, priv: 0.7 }],
  claims: [],
  changes: [],
})

const part = (md: string, n: number) => md.split(/^## /m).find((s) => s.startsWith(`${n}. `)) ?? ''

test('guard 15: a planted key in a recording or report is found; clean text passes', () => {
  expect(scanSecrets('{"authorization":"Bearer abcdefghijklmnop1234"}')).toEqual(['bearer token'])
  expect(scanSecrets('key=sk-proj-abcdefghijklmnopqrstuv')).toContain('sk- key')
  expect(scanSecrets('tvly-abcdefghijklmnopqrstuvwx and AKIAABCDEFGHIJKLMNOP')).toHaveLength(2)
  expect(scanSecrets('cookie: session=abc123')).toEqual(['cookie header'])
  expect(scanSecrets('"x-api-key": "0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b"')).toEqual(['exa key'])
  expect(scanSecrets(reportMarkdown(input([result('webular', 0.8)])))).toEqual([])
})

test(
  'guard 15: scanFiles names the recording that holds a key',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const dir = yield* tmpDir('guards-report-')
      const dirty = path.join(dir, 'dirty.json')
      const clean = path.join(dir, 'clean.json')
      yield* fs.writeFileString(dirty, '{"h":"ghp_abcdefghijklmnopqrstuvwxyz0123456789"}')
      yield* fs.writeFileString(clean, '{"h":"[redacted]"}')
      const hits = yield* scanFiles([dirty, clean])
      expect(hits).toEqual([{ file: dirty, shapes: ['github token'] }])
    }),
  ),
)

test('guard 17: webular cost missing the Jev call is caught; full count passes', () => {
  expect(costViolations([row('webular', [search])])).toEqual([
    `webular/t1/1: webular cost is missing the Jev call to ${JEV_HOST}`,
  ])
  expect(costViolations([row('webular', [jev, search])])).toEqual([])
  expect(costPerCorrect([row('webular', [jev, search])], 1)).toBeCloseTo(0.0021, 6)
  expect(costPerCorrect([row('webular', [jev])], 0)).toBeNull()
})

test('guard 18: a cost row with no price source or date is caught; dated rows pass', () => {
  const bare: OutboundCall = { ...search, priceSource: '', priceDate: '' }
  expect(costViolations([row('peer', [bare])])).toEqual([
    'peer/t1/1: search.test has no price source URL',
    'peer/t1/1: search.test has no price date',
  ])
  const model = tokenCall('gpt-5', 1000, 1000, 10)
  expect(model).toBeDefined()
  expect(model === undefined ? ['missing'] : costViolations([row('peer', [model])])).toEqual([])
  expect(tokenCall('unknown-model', 1, 1, 1)).toBeUndefined()
})

test('guard 25: not offered is never 0 and webular-only fixtures stay out of headlines', () => {
  const md = reportMarkdown(
    input([result('webular', 0.8), result('peer', null), result('webular', 0.9, true)]),
  )
  const head = part(md, 2)
  expect(head).toContain('| peer | 120 | not offered |')
  expect(head).not.toMatch(/\| peer \| 120 \| 0\.00/)
  expect(head).not.toContain('feed.items')
  expect(part(md, 9)).toContain('webular-only fixture')
  expect(headline([result('webular', 0.9, true)])).toEqual([])
})

const PARTS = [
  'Header',
  'Results per family',
  'Answer job split',
  'Latency',
  'Cost and accuracy',
  'Slices',
  'Public against private',
  'Errors',
  'Capability section',
  'Vendor claims',
  'Changes',
]

test('report shape: exactly eleven parts in order, cold and warm apart, no pooled p50', () => {
  const md = reportMarkdown(input([result('webular', 0.8)]))
  expect([...md.matchAll(/^## \d+\. (.+)$/gm)].map((m) => m[1])).toEqual(PARTS)
  expect(md).not.toMatch(/pooled|agent track|grader track/i)
  const lat = part(md, 4)
  expect(lat).toContain('| webular | answer.short | cold | 100 |')
  expect(lat).toContain('| webular | answer.short | warm | 10 |')
  expect(part(md, 7)).toContain('FLAGGED')
  expect(part(md, 8)).toContain('| peer | timeout | 1 | t1 run 1 |')
  expect(part(md, 5)).toContain('https://typesafe.ai/pricing (2026-10-21)')
})

test(
  'writeReport writes report.md and report.json into the given folder',
  eff(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const dir = path.join(yield* tmpDir('guards-report-'), 'out')
      yield* writeReport(dir, input([result('webular', 0.8)]))
      const json = yield* fs.readFileString(path.join(dir, 'report.json'))
      expect(json.match(/"taskId"/g)).toHaveLength(3)
      expect(json).toContain(`"${JEV_HOST}",\n        "search.test"`)
      expect(yield* fs.readFileString(path.join(dir, 'report.md'))).toContain('## 11. Changes')
    }),
  ),
)
