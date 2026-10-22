// Summarize job adapter: Exa POST /contents with `summary` (synchronous). Both
// arms get the same sentence budget; the summary text is graded for key facts.
import { Effect, Schema } from 'effect'
import type { Output, Provider } from './model.ts'
import { out, type Post } from './peers.ts'

export const SUMMARY_SENTENCES = 5
// Exa contents with summary: $1 per 1,000 pages when the reply carries no cost.
const EXA_SUMMARY_USD = 0.001

type Jobs = Provider['jobs']
const ExaSummaries = Schema.Struct({
  results: Schema.Array(Schema.Struct({ summary: Schema.optionalKey(Schema.String) })),
  costDollars: Schema.optionalKey(Schema.Struct({ total: Schema.Number })),
})

/** The webular summarize workflow's output: its summary text. */
export const SummarizeOut = Schema.Struct({ summary: Schema.String })

export const summarized = (text: string, url: string, costUsd: number, sentBytes: number): Output =>
  out(text, [url], costUsd, sentBytes)

export const exaSummarize = (post: Post, key: string): Jobs => ({
  summarize: ({ url = '' }) =>
    post(
      'https://api.exa.ai/contents',
      { 'x-api-key': key },
      { urls: [url], summary: true },
      ExaSummaries,
    ).pipe(
      Effect.map(({ r, sentBytes }) =>
        summarized(
          r.results.map((h) => h.summary ?? '').join('\n'),
          url,
          r.costDollars?.total ?? EXA_SUMMARY_USD,
          sentBytes,
        ),
      ),
    ),
})
