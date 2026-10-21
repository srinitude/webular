// summary follow-up: after summarize.lead, one summarize.core call per sentence swaps
// sure filler picks for sure core sentences.
import { Effect } from 'effect'
import { JEV_CONCURRENCY } from '../client.ts'
import {
  allSentences,
  coreDecision,
  MAX_ITEMS,
  type SummaryInput,
  type Verdict,
} from './summarize.ts'

// Picks Jev surely calls filler give way to unpicked sentences it surely calls core;
// the picks stay when there are too few replacements.
export const followUp = (picks: ReadonlyArray<number>, verdicts: ReadonlyArray<Verdict>) => {
  const kept = picks.filter((i) => verdicts[i] !== 'filler')
  const extra = verdicts.flatMap((v, i) => (v === 'core' && !picks.includes(i) ? [i] : []))
  const out = [...kept, ...extra.slice(0, picks.length - kept.length)].sort((a, b) => a - b)
  return out.length === picks.length ? out : picks
}

export const summaryFollowUp = (input: SummaryInput, picks: ReadonlyArray<number>) => {
  const n = allSentences(input.text).length
  if (n > MAX_ITEMS || picks.length >= n) return Effect.succeed(picks)
  return Effect.forEach(
    Array.from({ length: n }, (_, i) => i),
    (i) => coreDecision({ text: input.text, i }),
    { concurrency: JEV_CONCURRENCY },
  ).pipe(Effect.map((verdicts) => followUp(picks, verdicts)))
}
