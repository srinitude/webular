// summary follow-up: after summarize.lead, one summarize.core call per pool sentence
// swaps sure filler picks for sure core sentences.
import { Effect } from 'effect'
import { JEV_CONCURRENCY } from '../client.ts'
import {
  allSentences,
  coreDecision,
  type SummaryInput,
  type SummaryPick,
  type Verdict,
} from './summarize.ts'
import { candidatePool } from './summarize-pool.ts'

// Picks Jev surely calls filler give way to unpicked sentences it surely calls core;
// the picks stay when there are too few replacements.
export const followUp = (picks: ReadonlyArray<number>, verdicts: ReadonlyArray<Verdict>) => {
  const kept = picks.filter((i) => verdicts[i] !== 'filler')
  const extra = verdicts.flatMap((v, i) => (v === 'core' && !picks.includes(i) ? [i] : []))
  const out = [...kept, ...extra.slice(0, picks.length - kept.length)].sort((a, b) => a - b)
  return out.length === picks.length ? out : picks
}

// Only pool sentences are asked; every other sentence stays 'unsure'. The lead stays
// only while it is still picked.
export const summaryFollowUp = (input: SummaryInput, { picks, lead }: SummaryPick) => {
  const n = allSentences(input.text).length
  if (picks.length >= n) return Effect.succeed<SummaryPick>({ picks, lead })
  const pool = candidatePool(input.text, input.topN, undefined, picks)
  return Effect.forEach(pool, (i) => coreDecision({ text: input.text, i, topN: input.topN }), {
    concurrency: JEV_CONCURRENCY,
  }).pipe(
    Effect.map((got) => {
      const at = new Map(pool.map((i, k) => [i, got[k] ?? 'unsure']))
      const out = followUp(
        picks,
        Array.from({ length: n }, (_, i) => at.get(i) ?? 'unsure'),
      )
      return { picks: out, lead: lead !== undefined && out.includes(lead) ? lead : undefined }
    }),
  )
}
