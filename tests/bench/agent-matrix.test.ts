// Contract: the agent matrix names every arm under every agent model, scores
// only cells that ran, reports a missing key as skipped, and the committed
// docs carry every cell. Offline: replays rows, calls nothing.
import { expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'
import { Effect, FileSystem } from 'effect'
import {
  AGENT_MODELS,
  MATRIX_ARMS,
  type MatrixRow,
  matrixBlock,
  pickModelsRun,
} from '../../scripts/bench/peers/matrix.ts'
import { eff } from '../_support/run.ts'

const root = fileURLToPath(new URL('../../', import.meta.url))
const row = (provider: string, model: string, pass: boolean, extra = {}): MatrixRow => ({
  model,
  provider,
  pass,
  skipped: false,
  problems: pass ? [] : ['wrong answer'],
  toolCalls: [{}, {}],
  inputTokens: 100,
  outputTokens: 20,
  wallMs: 900,
  costUsd: 0.01,
  ...extra,
})

const replay = [
  row('webular-jev-off', 'claude-opus-5-5', true),
  row('webular-jev-off', 'claude-opus-5-5', false),
  row('webular-jev-on', 'claude-opus-5-5', false, {
    skipped: true,
    problems: ['skipped: no key (TYPESAFE_API_KEY or Keychain typesafe-ai-api-key)'],
  }),
]

const byModel = (text: string) =>
  Object.fromEntries(
    AGENT_MODELS.map((m) => [m, text.split('\n').find((l) => l.includes(`**${m}:**`)) ?? '']),
  )

const missing = (text: string) =>
  AGENT_MODELS.flatMap((m) =>
    MATRIX_ARMS.filter((arm) => !byModel(text)[m]?.includes(` ${arm} `)).map((a) => `${m}/${a}`),
  )

test('a replayed run fills every arm by model cell, scored or skipped, never faked', () => {
  const block = matrixBlock(replay, 'models-x.json', '')
  expect(missing(block)).toEqual([])
  const opus = byModel(block)['claude-opus-5-5']
  expect(opus).toContain(
    'webular-jev-off 0.500 (2 runs, 1 sure-but-wrong, p50 900 ms, 2.0 tool calls, 240 tokens, 0.0200 USD)',
  )
  expect(opus).toContain('webular-jev-on skipped: no key;')
  expect(byModel(block)['claude-haiku-5-5']).toContain('exa not run;')
  expect(byModel(block)['claude-haiku-5-5']).toContain('valyu skipped: no agent adapter;')
})

test(
  'the committed benchmarks page carries every cell of the matrix (fix: mise run bench:docs)',
  eff(
    Effect.gen(function* () {
      const doc = yield* (yield* FileSystem.FileSystem).readFileString(`${root}docs/benchmarks.md`)
      const block = /<!-- bench:start matrix -->\n([\s\S]*?)<!-- bench:end -->/.exec(doc)?.[1]
      expect(block).toBeDefined()
      expect(missing(block ?? '')).toEqual([])
    }),
  ),
)

test('the latest full agent run is picked by the time in its name; smoke runs never count', () => {
  const names = [
    'models-2026-10-20-120000-11.json',
    'models-2026-10-21-090000-7.json',
    'models-2026-10-22-smoke-090000-7.json',
    'peers-2026-10-22T00-58-50-543Z.json',
  ]
  expect(pickModelsRun(names)).toBe('models-2026-10-21-090000-7.json')
  expect(pickModelsRun([])).toBeUndefined()
})
