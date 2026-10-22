// Contract: every command in docs/command-parity.md's "Commands with a rival"
// table has a pass in the committed peer run, or a written ceiling with
// evidence in bench/command-parity-ceilings.json. A command with neither fails
// loudly, listed by name. Fix a failure by raising the run or by writing a
// ceiling with evidence.
import { expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'
import { Effect } from 'effect'
import type { RunRecord } from '../../scripts/bench/peers/model.ts'
import {
  type Ceiling,
  load,
  mappedCommands,
  parity,
  verdictFor,
} from '../../scripts/bench/peers/parity.ts'
import { eff } from '../_support/run.ts'

const root = fileURLToPath(new URL('../../', import.meta.url))

const row = (provider: string, task: string, accuracy: number, latencyMs: number): RunRecord => ({
  provider,
  task,
  job: 'map',
  run: 1,
  status: 'ok',
  metrics: { accuracy, latencyMs },
})
const both = (rival: string, webAcc: number, rivalAcc: number, webMs: number, rivalMs: number) =>
  ['t1', 't2', 't3'].flatMap((t) => [
    row('webular', t, webAcc, webMs),
    row(rival, t, rivalAcc, rivalMs),
  ])
const ceiling: Ceiling = { command: 'map', reason: 'network bound', evidence: 'bench/results/x' }

test('the mapped commands are the doc table rows, in order', () => {
  const doc =
    '## Commands with a rival\n\n| Command |\n|---|\n| `search` | a |\n| `map` | b |\n\n## Other\n\n| `feed` | c |'
  expect(mappedCommands(doc)).toEqual(['search', 'map'])
})

test('a command passes when accuracy ties and p50 is inside the bar', () => {
  expect(verdictFor('map', both('firecrawl', 1, 1, 105, 100), []).result).toBe('pass')
})

test('webular must match the best rival, not the average', () => {
  const rows = [...both('firecrawl', 1, 0, 100, 100), ...both('tavily', 1, 1, 100, 100)]
  expect(verdictFor('map', rows, []).result).toBe('pass')
  const worse = [...both('firecrawl', 0, 0, 100, 100), ...both('tavily', 0, 1, 100, 100)]
  expect(verdictFor('map', worse, []).result).toBe('fail')
})

test('lower accuracy or a slower p50 fails without a ceiling and holds with one', () => {
  const slow = both('firecrawl', 1, 1, 500, 100)
  expect(verdictFor('map', slow, [])).toMatchObject({ result: 'fail' })
  expect(verdictFor('map', slow, [])).toMatchObject({ detail: expect.stringContaining('p50') })
  expect(verdictFor('map', both('exa', 0, 1, 100, 100), [])).toMatchObject({
    detail: expect.stringContaining('accuracy'),
  })
  expect(verdictFor('map', slow, [ceiling]).result).toBe('ceiling')
})

test('a rival repeat flagged cached does not set the latency bar', () => {
  const repeat = { run: 2, cached: true, metrics: { accuracy: 1, latencyMs: 5 } }
  const warm = both('exa', 1, 1, 500, 500).flatMap((r) =>
    r.provider === 'exa' ? [r, { ...r, ...repeat }] : [r],
  )
  expect(verdictFor('map', warm, []).result).toBe('pass')
})

test('a command with no shared task fails unless a ceiling covers it', () => {
  const alone = [row('webular', 't1', 1, 10)]
  expect(verdictFor('map', alone, [])).toMatchObject({ result: 'fail' })
  expect(verdictFor('map', [], [ceiling]).result).toBe('ceiling')
  expect(verdictFor('map', [{ ...row('exa', 't1', 1, 1), status: 'skipped' }], []).result).toBe(
    'fail',
  )
})

test('every command in the doc table is covered by the doc parser and the run', () => {
  const doc = '## Commands with a rival\n\n| `map` | x |\n| `crawl` | y |\n'
  const out = parity(doc, both('firecrawl', 1, 1, 100, 100), [])
  expect(out.map((v) => [v.command, v.result])).toEqual([
    ['map', 'pass'],
    ['crawl', 'fail'],
  ])
})

test(
  'the committed run passes or has a written ceiling for every mapped command',
  eff(
    Effect.gen(function* () {
      const { name, doc, ceilings, records } = yield* load(root)
      const commands = mappedCommands(doc)
      expect(commands.length).toBeGreaterThanOrEqual(13)
      for (const c of ceilings) expect(commands).toContain(c.command)
      const failing = parity(doc, records, ceilings)
        .filter((v) => v.result === 'fail')
        .map((v) => `${v.command}: ${v.detail}`)
      expect({ run: name, failing }).toEqual({ run: name, failing: [] })
    }),
  ),
)
