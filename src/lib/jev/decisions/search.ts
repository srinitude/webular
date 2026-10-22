// search: the relevance order of web hits. It acts only at the 0.95 bar and
// otherwise keeps the search chain's order. The parallel chain asks every
// keyless source at once, so no source-routing or hits-fit decision lives here.
import type { JevAnswer } from '../client.ts'
import { defineDecision } from '../define.ts'
import { CONFIDENCE_BAR, type OptionSpec, purpose, score, scored } from '../payload/index.ts'

const DOCS = 'b0b26ab933a61b5d43ccccae5fbd009f445bfdcfd2808cac9e410a84f0fd8ca4'
const MAX_ITEMS = 20 // one call carries at most 20 hit questions
const MAX_QUERY = 300
const MAX_TEXT = 400

interface Hit {
  readonly title: string
  readonly url: string
  readonly description: string
}
interface HitsInput {
  readonly query: string
  readonly hits: ReadonlyArray<Hit>
}
const hitsState = (purposeOf: ReturnType<typeof purpose>, { query, hits }: HitsInput) => ({
  purpose: purposeOf,
  facts: {
    search: { query: query.slice(0, MAX_QUERY) },
    hits: Object.fromEntries(
      hits
        .slice(0, MAX_ITEMS)
        .map((h, i) => [
          `h${i}`,
          { title: h.title, url: h.url, text: h.description.slice(0, MAX_TEXT) },
        ]),
    ),
  },
})
const perHit = <Q>(hits: ReadonlyArray<Hit>, ask: (key: string) => Q) =>
  Object.fromEntries(hits.slice(0, MAX_ITEMS).map((_, i) => [`h${i}`, ask(`facts.hits.h${i}`)]))
const SAMPLE: HitsInput = {
  query: 'effect typescript library',
  hits: [{ title: 'Effect docs', url: 'https://effect.website/docs', description: 'Guide.' }],
}

// ── rank: relevance order of hits before the limit cut ──
const RANK_PURPOSE = purpose(
  'We list web search hits for a reader.',
  'Put the hits most about the query at the top.',
  'The list is cut at a limit, so order decides what the reader sees.',
  'Search engines mix ads, loose keyword matches, and same-name topics into results.',
)
const RANK_LEVELS: ReadonlyArray<OptionSpec> = [
  {
    what: 'Off topic: the hit is about a different subject, even if it shares a word with the query.',
    examples: ['query "jaguar top speed", hit about Jaguar the car brand dealership hours'],
  },
  {
    what: 'Related but not what was asked: same subject area, but it does not answer the query.',
    not_for: 'A hit on a different subject that only shares a word.',
  },
  {
    what: 'Directly about the query: the hit covers the exact thing the query asks for.',
    examples: ['query "jaguar top speed", hit giving how fast the jaguar cat runs'],
  },
]
const MIDDLE = 1
const RANK_ASK = (h: string) => ({
  task: `Judge how directly the hit \`${h}\` (its title, url, and text) is about \`facts.search.query\`.`,
  answer_wanted: 'Pick the one level that fits best.',
  rules: [
    'Judge the meaning of the query as a whole, not single shared words.',
    'A word with two meanings counts only in the sense the query means.',
  ],
})
// Stable re-rank; a hit Jev is unsure of keeps the middle level.
const rankRead = (a: Record<string, JevAnswer>, bar: number, { hits }: HitsInput) => {
  const items = hits.slice(0, MAX_ITEMS)
  const level = items.map((_, i) => scored(a[`h${i}`], bar, MIDDLE))
  const order = items
    .map((_, i) => i)
    .sort((x, y) => (level[y] ?? MIDDLE) - (level[x] ?? MIDDLE) || x - y)
  return [...order.flatMap((i) => items[i] ?? []), ...hits.slice(MAX_ITEMS)]
}
export const searchRank = defineDecision<HitsInput, ReadonlyArray<Hit>>({
  name: 'search.rank',
  payload: (input) => ({
    state: hitsState(RANK_PURPOSE, input),
    questions: perHit(input.hits, (h) => score(RANK_ASK(h), RANK_LEVELS)),
  }),
  sample: () => SAMPLE,
  subtasks: [
    {
      name: 'relevance',
      primitive: 'score',
      pattern: 'composite-scoring',
      payload: { question: 'h0' },
    },
  ],
  read: rankRead,
  bar: CONFIDENCE_BAR,
  fallback: ({ hits }) => hits,
  // A re-rank keeps every hit exactly once.
  codeCheck: (ranked, { hits }) =>
    ranked.length === hits.length && hits.every((h) => ranked.includes(h)),
  evals: 'tests/jev/evals/search.rank.json',
  docs: DOCS,
})
