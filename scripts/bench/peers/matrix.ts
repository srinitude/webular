// The agent matrix: every tool arm under every agent model, from the committed
// three-model agent run with the highest name time (`mise run test:models --
// --agent`). Each cell is scored, skipped with its reason, or not run; no cell
// is filled in.
import { JEV_ARMS } from '../../../tests/models/agent/arm.ts'
import scenarios from '../../../tests/models/scenarios.json'

export const AGENT_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'] as const

// Every alternative in the rival brief, by peer id. Only some have an agent
// (MCP) arm in tests/models/scenarios.json; the rest show as not run.
export const ALTERNATIVES = [
  'exa',
  'firecrawl',
  'parallel',
  'tavily',
  'perplexity',
  'youcom',
  'jina',
  'linkup',
  'valyu',
  'serpapi',
  'serper',
  'gemini',
  'apify',
  'brightdata',
  'browserbase',
  'scrapegraph',
  'nimble',
  'tinyfish',
  'contextdev',
  'searxng',
  'crawl4ai',
  'trafilatura',
  'readability',
] as const

export const MATRIX_ARMS: readonly string[] = [...JEV_ARMS, ...ALTERNATIVES]

// Arms the agent track can drive: both webular arms and each peer with an MCP entry.
const DRIVEN = new Set<string>([...JEV_ARMS, ...scenarios.providers.map((p) => p.id)])

export interface MatrixRow {
  model: string
  provider: string
  pass: boolean
  skipped: boolean
  problems: readonly string[]
  toolCalls: readonly unknown[]
  inputTokens?: number
  outputTokens?: number
  wallMs: number
  costUsd: number | null
}

const MODELS_RUN = /^models-(\d{4}-\d{2}-\d{2})-(\d{6})-\d+\.json$/

// The agent run with the highest date and time in its name; smoke runs never count.
export const pickModelsRun = (names: readonly string[]) =>
  names
    .flatMap((n) => {
      const m = MODELS_RUN.exec(n)
      return m ? [{ n, k: `${m[1]}${m[2]}` }] : []
    })
    .toSorted((a, b) => (a.k < b.k ? 1 : -1))[0]?.n

const p50 = (xs: number[]) => xs.toSorted((a, b) => a - b)[Math.floor((xs.length - 1) / 2)] ?? 0
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
// A graded miss that came back without a timeout or error: sure, but wrong.
const sureWrong = (r: MatrixRow) =>
  !r.pass && !r.problems.some((p) => p === 'timed out' || p.startsWith('claude reported'))

const cell = (rows: readonly MatrixRow[], arm: string, model: string) => {
  const mine = rows.filter((r) => r.model === model && r.provider === arm)
  const ran = mine.filter((r) => !r.skipped)
  if (ran.length === 0) {
    const why = mine.flatMap((r) => r.problems).find((p) => p.startsWith('skipped:'))
    const idle = DRIVEN.has(arm) ? 'not run' : 'skipped: no agent adapter'
    return `${arm} ${why ? why.replace(/ \(.*\)$/, '') : idle}`
  }
  const score = (ran.filter((r) => r.pass).length / ran.length).toFixed(3)
  const tokens = sum(ran.map((r) => (r.inputTokens ?? 0) + (r.outputTokens ?? 0)))
  const cost = sum(ran.map((r) => r.costUsd ?? 0)).toFixed(4)
  const calls = (sum(ran.map((r) => r.toolCalls.length)) / ran.length).toFixed(1)
  const wrong = ran.filter(sureWrong).length
  const ms = p50(ran.map((r) => r.wallMs))
  return `${arm} ${score} (${ran.length} runs, ${wrong} sure-but-wrong, p50 ${ms} ms, ${calls} tool calls, ${tokens} tokens, ${cost} USD)`
}

const cells = (rows: readonly MatrixRow[], model: string) =>
  MATRIX_ARMS.map((a) => cell(rows, a, model))

const source = (name: string | undefined, prefix: string) =>
  name ? `[${name}](${prefix}${name})` : 'no committed agent run'

// One line per model, naming every arm, so no cell can drop out unseen.
export const matrixBlock = (rows: readonly MatrixRow[], name: string | undefined, prefix: string) =>
  [
    `Each line is one agent model, and each entry is one tool arm, from ${source(name, prefix)}. Every cell uses the same tasks, grader, seed, and prompt; only the tool changes. A cell says skipped when its key or its agent adapter is missing.`,
    '',
    ...AGENT_MODELS.map((m) => `- **${m}:** ${cells(rows, m).join('; ')}.`),
  ].join('\n')

export const matrixHeadline = (rows: readonly MatrixRow[], name: string | undefined) => {
  const scored = AGENT_MODELS.flatMap((m) => cells(rows, m)).filter((c) => /\d\.\d{3} \(/.test(c))
  const all = AGENT_MODELS.length * MATRIX_ARMS.length
  return `- **Agent matrix.** ${scored.length} of ${all} cells scored: webular with Jev off and on, and ${ALTERNATIVES.length} alternatives, on ${AGENT_MODELS.length} agent models. Source: ${name ?? 'no committed agent run'}.`
}
