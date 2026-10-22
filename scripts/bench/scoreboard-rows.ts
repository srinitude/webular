// What each command is scored on, and the offline eval values. A value here is
// what its eval printed on this code; the eval asserts it through
// tests/_support/scoreboard.ts, so a stale value fails that eval.
// A metric listed for a command with no value and no peer number is a gap.
import { COMMANDS, type CommandName } from '../../src/cli/commands.ts'

export interface Offline {
  value: number
  eval: string
  set: 'dev' | 'test'
  ceiling?: string
}

const DELIVERY = ['test pass rate', 'determinism', 'latency p50 ms', 'latency p95 ms']
const RANKED = ['hit@1', 'hit@10', 'precision', 'recall', 'cost per success usd', 'robustness']
const GROUNDED = ['accuracy', 'citation faithfulness', 'sure-but-wrong', 'no-answer rate']
const JUDGED = [...GROUNDED, 'Jev eval pass rate', 'cost per success usd', 'robustness']

// Metrics that apply to each command. Tool commands (doctor, tasks, mcp,
// diagram, audit) are scored by their contract tests only.
export const APPLIES: Record<CommandName, readonly string[]> = {
  search: ['accuracy', ...RANKED, ...DELIVERY],
  scrape: [
    'accuracy',
    'recall',
    'leak',
    'script pages routed to browser',
    'robustness',
    ...DELIVERY,
  ],
  crawl: ['precision', 'recall', 'F1', ...DELIVERY],
  map: ['precision', 'recall', 'F1', ...DELIVERY],
  extract: ['exact match', 'normalized match', ...DELIVERY],
  summarize: [
    'ROUGE-1 F1',
    'ROUGE-2 F1',
    'oracle ROUGE-1',
    'coverage',
    'faithfulness',
    ...DELIVERY,
  ],
  answer: [...JUDGED, ...DELIVERY],
  research: [...JUDGED, ...DELIVERY],
  parse: ['accuracy', ...DELIVERY],
  media: ['accuracy', ...DELIVERY],
  monitor: ['accuracy', ...DELIVERY],
  batch: ['accuracy', ...DELIVERY],
  doctor: ['test pass rate'],
  tasks: ['test pass rate'],
  mcp: ['test pass rate'],
  upgrade: ['test pass rate'],
  completions: ['test pass rate'],
  diagram: ['test pass rate'],
  audit: ['test pass rate'],
  act: ['test pass rate', 'robustness'],
  feed: ['accuracy', ...DELIVERY],
  jev: ['Jev eval pass rate', 'test pass rate'],
}

const MAP = 'tests/commands/map-accuracy.test.ts'
const EXTRACT = 'tests/commands/extract-accuracy.test.ts'
const SUMMARIZE = 'tests/commands/summarize-accuracy.test.ts'
const SCRAPE = 'tests/bench/scrape-accuracy.test.ts'
const SCRIPT_CEILING =
  '7 of 46 pages render only in a browser; offline recall tops out at 39/46 until a live render runs'
const CRAWL = 'tests/commands/crawl-accuracy.test.ts'
const at = (file: string) => ({
  eval: `tests/commands/${file}-accuracy.test.ts`,
  set: 'dev' as const,
})
const perfect = (file: string) => ({
  accuracy: { value: 1, ...at(file) },
  determinism: { value: 1, ...at(file) },
})
const ROUGE_CEILING =
  'ROUGE against a human-written summary cannot reach 1.000 for a summary built only from source sentences'

export const OFFLINE: Partial<Record<CommandName, Record<string, Offline>>> = {
  map: {
    precision: { value: 1, eval: MAP, set: 'dev' },
    recall: { value: 1, eval: MAP, set: 'dev' },
    F1: { value: 1, eval: MAP, set: 'dev' },
  },
  crawl: {
    precision: { value: 1, eval: CRAWL, set: 'dev' },
    recall: { value: 1, eval: CRAWL, set: 'dev' },
    F1: { value: 1, eval: CRAWL, set: 'dev' },
    determinism: { value: 1, eval: CRAWL, set: 'dev' },
  },
  batch: perfect('batch'),
  feed: perfect('feed'),

  extract: {
    'exact match': { value: 1, eval: EXTRACT, set: 'dev' },
    'normalized match': { value: 1, eval: EXTRACT, set: 'dev' },
  },
  summarize: {
    'ROUGE-1 F1': { value: 0.1867, eval: SUMMARIZE, set: 'dev', ceiling: ROUGE_CEILING },
    'ROUGE-2 F1': { value: 0.0474, eval: SUMMARIZE, set: 'dev', ceiling: ROUGE_CEILING },
    'oracle ROUGE-1': { value: 0.2399, eval: SUMMARIZE, set: 'dev', ceiling: ROUGE_CEILING },
    coverage: { value: 0.761, eval: SUMMARIZE, set: 'dev', ceiling: ROUGE_CEILING },
    faithfulness: { value: 1, eval: SUMMARIZE, set: 'dev' },
  },
  scrape: {
    recall: { value: 39 / 46, eval: SCRAPE, set: 'dev', ceiling: SCRIPT_CEILING },
    leak: { value: 0, eval: SCRAPE, set: 'dev' },
    'script pages routed to browser': { value: 1, eval: SCRAPE, set: 'dev' },
  },
  parse: { accuracy: { value: 1, eval: 'tests/quality/parse-pdf-fidelity.test.ts', set: 'dev' } },
}

export const COMMAND_LIST = Object.keys(COMMANDS) as CommandName[]
