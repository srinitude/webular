// search: which keyless source fits a query, whether a source's hits fit the
// query, and the relevance order of web hits. Each acts only at the 0.95 bar
// and otherwise keeps the search chain's baseline.
import { Effect } from 'effect'
import { SEARCH_SOURCES, type SearchSource } from '../../sources-search.ts'
import { type Jev, type JevAnswer, jevRuntime } from '../client.ts'
import { defineDecision } from '../define.ts'
import {
  agreedPick,
  bothOrders,
  CONFIDENCE_BAR,
  choice,
  menu,
  noul,
  purpose,
  score,
  scored,
  sureYes,
} from '../payload/index.ts'

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

// ── route: which keyless source should answer the query? Default first. ──
const SOURCES: Record<SearchSource, string> = {
  web: 'General web pages. The default for anything not clearly covered below.',
  wikipedia: 'Only when the query asks for encyclopedia facts: people, places, history.',
  hackernews: 'Only when the query is about tech news, launches, or developer threads.',
  arxiv: 'Only when the query asks for preprints in physics, math, CS, or machine learning.',
  crossref: 'Only when the query asks for published journal articles or DOIs.',
  openalex: 'Only when the query asks for scholarly works, authors, or citations.',
  npm: 'Only when the query names a JavaScript or TypeScript package or its official site.',
}
const isSource = (s: string): s is SearchSource => (SEARCH_SOURCES as readonly string[]).includes(s)
const ROUTE_PURPOSE = purpose(
  'We search for a reader who did not pick a source.',
  'Send the query to the one source most likely to hold good hits.',
  'A wrong source gives empty or off-topic hits and wastes a fetch.',
  'General web is the safe default. Pick a special source only when the query clearly fits it.',
)
const ROUTE_QUESTIONS = bothOrders(
  'source',
  choice(
    'Which source best fits `search.query`?',
    menu('web', SEARCH_SOURCES, (k) => (isSource(k) ? SOURCES[k] : null)),
  ),
)
export const searchRoute = defineDecision<{ readonly query: string }, SearchSource>({
  name: 'search.route',
  payload: ({ query }) => ({
    state: { purpose: ROUTE_PURPOSE, search: { query: query.slice(0, MAX_QUERY) } },
    questions: ROUTE_QUESTIONS,
  }),
  sample: () => ({ query: 'attention is all you need transformer preprint' }),
  subtasks: [
    {
      name: 'source',
      primitive: 'choice',
      pattern: 'intent-routing',
      payload: { question: 'source' },
    },
  ],
  // Both orders must agree at the bar; agreedPick never returns `none`.
  read: (a, bar) => {
    const pick = agreedPick(a, 'source', bar)
    return pick !== undefined && isSource(pick) ? pick : undefined
  },
  bar: CONFIDENCE_BAR,
  fallback: () => 'web',
  codeCheck: (pick) => isSource(pick),
  evals: 'tests/jev/evals/search.route.json',
  docs: DOCS,
})

// ── fit: do a source's hits fit the query? ──
const FIT_PURPOSE = purpose(
  'We try search sources in turn until one gives useful hits.',
  'Accept a source only when some hit is about the query.',
  'Accepting off-topic hits stops the chain before a better source is tried.',
  'Sources often return loose keyword matches on a different topic.',
)
// One sure fit accepts; rejects only when Jev is sure every hit is off topic.
const fitRead = (a: Record<string, JevAnswer>, bar: number, { hits }: HitsInput) => {
  const sure = hits.slice(0, MAX_ITEMS).map((_, i) => sureYes(a[`h${i}`], bar))
  if (sure.includes(true)) return true
  return sure.length > 0 && sure.every((s) => s === false) ? false : undefined
}
export const searchFit = defineDecision<HitsInput, boolean>({
  name: 'search.fit',
  payload: (input) => ({
    state: hitsState(FIT_PURPOSE, input),
    questions: perHit(input.hits, (h) => noul(`Is \`${h}\` about \`search.query\`?`)),
  }),
  sample: () => SAMPLE,
  subtasks: [{ name: 'fits', primitive: 'noul', pattern: 'fan-out', payload: { question: 'h0' } }],
  read: fitRead,
  bar: CONFIDENCE_BAR,
  fallback: ({ hits }) => hits.length > 0,
  // No hits never fit, whatever Jev says.
  codeCheck: (fits, { hits }) => !fits || hits.length > 0,
  evals: 'tests/jev/evals/search.fit.json',
  docs: DOCS,
})

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
