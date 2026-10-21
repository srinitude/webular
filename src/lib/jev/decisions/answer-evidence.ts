// answer evidence: which search hits to fetch as evidence. Acts only when both
// gating orders agree at the 0.95 bar; otherwise the engine's first n stay.
import type { JevAnswer } from '../client.ts'
import { defineDecision } from '../define.ts'
import {
  agreedPick,
  bothOrders,
  CONFIDENCE_BAR,
  choice,
  menu,
  purpose,
  score,
} from '../payload/index.ts'

const DOCS = '88a6a003018eaea50167565a766a0d4a91d039cf93cc7dc2965d3ceba3a72caf'
const MAX_HITS = 18 // 18 scores + 2 gating choices = the 20-question cap
const MAX_QUESTION = 300
const MAX_SNIPPET = 400

interface Hit {
  readonly title: string
  readonly url: string
  readonly description: string
}
interface HitsInput {
  readonly question: string
  readonly hits: ReadonlyArray<Hit>
  readonly n: number
}
const hitsBaseline = ({ hits, n }: HitsInput) => hits.slice(0, n)

const HITS_PURPOSE = purpose(
  'We answer a reader question from a few fetched web pages.',
  'Fetch the search hits whose pages hold the answer.',
  'We fetch only a few pages, so a bad pick means a weak or wrong answer.',
  'Search engines rank by keyword match; ads, shops, and look-alike topics sit near the top.',
)
const HIT_LEVELS = [
  'The page will not hold the answer',
  'The page may mention the topic',
  'The page likely holds part of the answer',
  'The page likely holds the full answer',
]
const hitText = (k: string) =>
  k === 'none' ? 'Only when no hit looks likely to answer' : `The page behind \`hits.${k}\``

const hitScores = (ids: ReadonlyArray<string>) =>
  Object.fromEntries(
    ids.map((k) => [
      k,
      score(
        `Judging only its title, url, and snippet, how likely is the page behind \`hits.${k}\` to answer \`question.text\`?`,
        HIT_LEVELS,
      ),
    ]),
  )

const hitsPayload = (input: HitsInput) => {
  const items = input.hits.slice(0, MAX_HITS)
  const ids = items.map((_, i) => `h${i}`)
  return {
    state: {
      purpose: HITS_PURPOSE,
      question: { text: input.question.slice(0, MAX_QUESTION) },
      fetch: { count: input.n, default: ids.slice(0, input.n) },
      hits: Object.fromEntries(
        items.map((h, i) => [
          `h${i}`,
          { title: h.title, url: h.url, snippet: h.description.slice(0, MAX_SNIPPET) },
        ]),
      ),
    },
    questions: {
      ...hitScores(ids),
      // Asked in both option orders (position check); the engine's top hit comes first.
      ...bothOrders(
        'lead',
        choice(
          'Which hit most likely leads to a page that answers `question.text`?',
          menu('h0', ids, hitText),
        ),
      ),
    },
  }
}

// Top n by score, engine order on ties; acts only when both orders agree on a hit in that top n.
const hitsRead = (a: Record<string, JevAnswer>, t: number, { hits, n }: HitsInput) => {
  const pick = agreedPick(a, 'lead', t)
  const top = hits
    .slice(0, MAX_HITS)
    .map((h, i) => ({ h, i, s: a[`h${i}`]?.score ?? -1 }))
    .sort((x, y) => y.s - x.s || x.i - y.i)
    .slice(0, n)
  return top.some((x) => `h${x.i}` === pick) ? top.map((x) => x.h) : undefined
}

// Exactly min(n, hits) distinct hits, all from the hit list.
const codeCheck = (picked: ReadonlyArray<Hit>, { hits, n }: HitsInput) =>
  picked.length === Math.min(n, hits.length) &&
  new Set(picked.map((h) => h.url)).size === picked.length &&
  picked.every((p) => hits.includes(p))

export const answerHits = defineDecision<HitsInput, ReadonlyArray<Hit>>({
  name: 'answer.hits',
  sample: () => ({
    question: 'what sqlite driver does bun ship',
    hits: [
      { title: 'Buy SQL books', url: 'https://shop.example/sql', description: 'Books on sale.' },
      { title: 'bun:sqlite', url: 'https://bun.sh/docs/api/sqlite', description: 'Bun SQLite.' },
    ],
    n: 1,
  }),
  subtasks: [
    {
      name: 'likely',
      primitive: 'score',
      pattern: 'composite-scoring',
      payload: { question: 'h0' },
    },
    {
      name: 'lead',
      primitive: 'choice',
      pattern: 'confidence-routing',
      payload: { question: 'lead' },
    },
  ],
  payload: hitsPayload,
  read: hitsRead,
  bar: CONFIDENCE_BAR,
  fallback: hitsBaseline,
  codeCheck: codeCheck,
  evals: 'tests/jev/evals/answer.hits.json',
  docs: DOCS,
})
