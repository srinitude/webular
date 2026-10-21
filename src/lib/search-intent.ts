// Which keyless free APIs a web search asks, by the query's intent.
import { Effect } from 'effect'
import { type Intent, intentBaseline, intentDecision } from './jev/decisions/search-intent.ts'
import { onJevRuntime } from './jev/run.ts'
import type { SearchSource } from './sources-search.ts'

// Free APIs per query intent; scraped engines (web = DuckDuckGo HTML) are the
// last fallback only, since from this IP they mostly answer 403/429/captcha.
// Software queries also ask npm, whose package homepages are official sites
// the other free APIs never return.
const SOURCES: Record<Intent, SearchSource[]> = {
  scholarly: ['openalex', 'arxiv', 'crossref', 'wikipedia'],
  software: ['wikipedia', 'hackernews', 'openalex', 'npm'],
  general: ['wikipedia', 'hackernews', 'openalex'],
}

// The keyword rule alone: the fallback when Jev is off or under the 0.95 bar.
export const pickSources = (query: string): SearchSource[] => SOURCES[intentBaseline({ query })]

// Jev reads the intent; below the bar or on any failure the keyword rule stands.
// Tests pass a decide that runs the decision on a recorded Jev reply.
export const pickSourcesJudged = (
  query: string,
  decide: (input: { query: string }) => Effect.Effect<Intent> = (i) =>
    onJevRuntime(intentDecision, i),
): Effect.Effect<SearchSource[]> => Effect.map(decide({ query }), (intent) => SOURCES[intent])
