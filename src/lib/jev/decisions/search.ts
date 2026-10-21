// search: the relevance order of web hits. It acts only at the 0.95 bar and
// otherwise keeps the search chain's order. The parallel chain asks every
// keyless source at once, so no source-routing or hits-fit decision lives here.
import { Effect } from 'effect'
import { type Jev, type JevAnswer, jevRuntime } from '../client.ts'
import { defineDecision } from '../define.ts'
import { CONFIDENCE_BAR, purpose, score, scored } from '../payload/index.ts'

const DOCS = '88a6a003018eaea50167565a766a0d4a91d039cf93cc7dc2965d3ceba3a72caf'
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
  search: { query: query.slice(0, MAX_QUERY) },
  hits: Object.fromEntries(
    hits
      .slice(0, MAX_ITEMS)
      .map((h, i) => [
        `h${i}`,
        { title: h.title, url: h.url, text: h.description.slice(0, MAX_TEXT) },
      ]),
  ),
})
const perHit = <Q>(hits: ReadonlyArray<Hit>, ask: (key: string) => Q) =>
  Object.fromEntries(hits.slice(0, MAX_ITEMS).map((_, i) => [`h${i}`, ask(`hits.h${i}`)]))
const SAMPLE: HitsInput = {
  query: 'effect typescript library',
  hits: [
    { title: 'Effect docs', url: 'https://effect.website/docs', description: 'Effect guide.' },
    { title: 'Effect on npm', url: 'https://npmjs.com/package/effect', description: 'Package.' },
  ],
}

// ── rank: relevance order of hits before the limit cut ──
const RANK_PURPOSE = purpose(
  'We list web search hits for a reader.',
  'Put the hits most about the query at the top.',
  'The list is cut at a limit, so order decides what the reader sees.',
  'Search engines mix ads, loose keyword matches, and same-name topics into results.',
)
const RANK_LEVELS = ['Off topic', 'Related but not what was asked', 'Directly about the query']
const MIDDLE = 1
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
    questions: perHit(input.hits, (h) =>
      score(`How directly is \`${h}\` about \`search.query\`?`, RANK_LEVELS),
    ),
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

// Runs a decision on the shared Jev runtime (one LRU, one key lookup), so lib
// Effects keep no Jev requirement; a runtime failure keeps the fallback.
export const onJevRuntime = <I, A>(
  d: ((input: I) => Effect.Effect<A, unknown, Jev>) & {
    readonly def: { readonly fallback: (i: I) => A }
  },
  input: I,
) =>
  Effect.tryPromise(() => jevRuntime.runPromise(d(input))).pipe(
    Effect.orElseSucceed(() => d.def.fallback(input)),
  )
