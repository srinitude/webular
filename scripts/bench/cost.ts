// Cost accounting (spec-grading-and-stats.md "Cost protocol", audit finding 5,
// guard tests 17 and 18): cost per correct answer is the dollars of every
// outbound call over the number of correct tasks. Webular's count includes
// Jev at api.typesafe.ai, search engines, and page fetches.
import type { OutboundCall, Row } from './schema.ts'

export const JEV_HOST = 'api.typesafe.ai'

// Public per-token list prices for the agent track, each with its source and
// the date it was read. Dollars per million tokens.
interface TokenRate {
  readonly model: string
  readonly host: string
  readonly inputPerMTok: number
  readonly outputPerMTok: number
  readonly priceSource: string
  readonly priceDate: string
}

const TOKEN_RATES: readonly TokenRate[] = [
  {
    model: 'claude-sonnet-4-5',
    host: 'api.anthropic.com',
    inputPerMTok: 3,
    outputPerMTok: 15,
    priceSource: 'https://www.anthropic.com/pricing#api',
    priceDate: '2026-10-21',
  },
  {
    model: 'gpt-5',
    host: 'api.openai.com',
    inputPerMTok: 1.25,
    outputPerMTok: 10,
    priceSource: 'https://openai.com/api/pricing/',
    priceDate: '2026-10-21',
  },
]

// One model call priced at its public rate; undefined for an unknown model,
// so an unpriced call is never silently counted as free.
export const tokenCall = (
  model: string,
  inputTokens: number,
  outputTokens: number,
  bytes: number,
): OutboundCall | undefined => {
  const rate = TOKEN_RATES.find((r) => r.model === model)
  if (rate === undefined) return undefined
  const usd = (inputTokens * rate.inputPerMTok + outputTokens * rate.outputPerMTok) / 1e6
  return {
    host: rate.host,
    kind: 'model',
    bytes,
    usd,
    priceSource: rate.priceSource,
    priceDate: rate.priceDate,
  }
}

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0)

export const rowUsd = (row: Row) => sum(row.calls.map((c) => c.usd))
export const rowBytes = (row: Row) => sum(row.calls.map((c) => c.bytes))
export const rowHosts = (row: Row) => [...new Set(row.calls.map((c) => c.host))].sort()

// Dollars of every outbound call over correct tasks; null when none is correct.
export const costPerCorrect = (rows: readonly Row[], correct: number): number | null =>
  correct > 0 ? sum(rows.map(rowUsd)) / correct : null

const DATE = /^\d{4}-\d{2}-\d{2}$/

const callViolations = (where: string, call: OutboundCall): string[] => [
  ...(/^https?:\/\//.test(call.priceSource)
    ? []
    : [`${where}: ${call.host} has no price source URL`]),
  ...(DATE.test(call.priceDate) ? [] : [`${where}: ${call.host} has no price date`]),
]

const isWebular = (row: Row) => row.key.provider === 'webular'
const hasJev = (row: Row) => row.calls.some((c) => c.kind === 'jev' && c.host === JEV_HOST)

// Guard 17 (webular counts its Jev call) and guard 18 (every call is dated
// and sourced). An empty list means the cost rows are complete.
export const costViolations = (rows: readonly Row[]): string[] =>
  rows.flatMap((row) => {
    const where = `${row.key.provider}/${row.key.taskId}/${row.key.run}`
    const missingJev =
      isWebular(row) && row.status !== 'not_offered' && !hasJev(row)
        ? [`${where}: webular cost is missing the Jev call to ${JEV_HOST}`]
        : []
    return [...missingJev, ...row.calls.flatMap((c) => callViolations(where, c))]
  })
