// map: score a discovered URL by usefulness (0 to 1), and judge its page kind
// (map.kind) to order a map or crawl best-first before a limit cuts it.
import { Effect } from 'effect'
import { JEV_CONCURRENCY } from '../client.ts'
import { defineDecision } from '../define.ts'
import {
  agreedPick,
  bothOrders,
  CONFIDENCE_BAR,
  choice,
  menu,
  type OptionSpec,
  purpose,
  score,
  scored,
} from '../payload/index.ts'

const MAX_URL = 300

const MAP_PURPOSE = purpose(
  'We list the most useful pages of a site.',
  'The top of the list holds the main pages a visitor looks for.',
  'The list is cut at a limit, so order decides what the user sees.',
  'Home, docs, product, pricing, and about pages matter most; archives and tag pages least.',
)
const MAP_LEVELS = [
  'Junk: tracking copy, tag list, or page number',
  'Minor: an old post or deep archive page',
  'Normal content page',
  'Main page: home, docs, product, pricing, or about',
]
export const mapDecision = defineDecision<{ readonly site: string; readonly url: string }, number>({
  name: 'map.rank',
  sample: () => ({ site: 'https://docs.example.dev', url: 'https://docs.example.dev/pricing' }),
  subtasks: [
    { name: 'useful', primitive: 'score', pattern: 'none', payload: { question: 'useful' } },
  ],
  payload: ({ site, url }) => ({
    state: { purpose: MAP_PURPOSE, facts: { url, site } },
    questions: {
      useful: score('How useful is `facts.url` to a visitor of `facts.site`?', MAP_LEVELS),
    },
  }),
  read: (a, t) => scored(a['useful'], t, 1.5) / 3,
  bar: CONFIDENCE_BAR,
  fallback: () => 0.5,
  codeCheck: (s) => s >= 0 && s <= 1,
  evals: 'tests/jev/evals/map.rank.json',
  docs: '88a6a003018eaea50167565a766a0d4a91d039cf93cc7dc2965d3ceba3a72caf',
})

// map.kind: what kind of page a discovered URL is, so a map or crawl limit
// keeps main pages and drops junk first. A Choice asked in both option orders;
// code acts only when both agree at the 0.95 bar (the lower confidence wins).
type Kind = 'main' | 'content' | 'junk'
interface KindInput {
  readonly site: string
  readonly url: string
}
const JUNK =
  /\/(login|signin|signup|register|cart|privacy|terms|cookies?|tags?|share|page\/\d+)(\/|\b)|[?&](utm_|replytocom|sort=|page=)/i
const kindBaseline = ({ url }: KindInput): Kind => (JUNK.test(url) ? 'junk' : 'content')
const KIND_PURPOSE = purpose(
  'We list or crawl the pages of a site for a reader.',
  'Main pages go first and junk pages go last, so a limit keeps the best pages.',
  'The list is cut at a limit, so the order decides which pages the reader gets.',
  'Most pages are normal content. Login, cart, legal, tag, page-number, and tracking copies add nothing.',
)
const KINDS: Record<string, OptionSpec> = {
  content: {
    what: 'A normal page with its own content: one article, guide, post, or product detail',
    not_for: 'A top page of the site, or a copy, list, or utility page',
  },
  main: {
    what: 'Only when the page is one a visitor of `facts.link.site` looks for first: home, docs index, product, pricing, or about',
    not_for: 'A single article, guide, or post deeper in the site',
  },
  junk: {
    what: 'Only when the page adds nothing for a reader: login, cart, share, legal, a tag or date list, a page number, or a print, tracking, or other copy of a page',
    not_for: 'A page with its own article, guide, or product text',
  },
  none: { what: 'Only when `facts.link.url` is not a web page at all' },
}
// The URL path as plain words (scheme, host, query, and hash dropped).
const pathWords = (url: string): string[] =>
  (url.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, '').split(/[?#]/)[0] ?? '')
    .split(/[/\-_.]+/)
    .filter(Boolean)
    .slice(0, 20)
// A URL the junk rule matches never ranks as a main page.
const codeCheck = (kind: Kind, input: KindInput): boolean =>
  kind !== 'main' || !JUNK.test(input.url)
const isKind = (k: string | undefined): k is Kind => k === 'main' || k === 'content' || k === 'junk'
export const kindDecision = defineDecision<KindInput, Kind>({
  name: 'map.kind',
  sample: () => ({ site: 'https://docs.example.dev/', url: 'https://docs.example.dev/pricing' }),
  subtasks: [
    {
      name: 'kind',
      primitive: 'choice',
      pattern: 'confidence-routing',
      payload: { question: 'kind' },
    },
  ],
  payload: ({ site, url }) => ({
    state: {
      purpose: KIND_PURPOSE,
      facts: {
        link: { site, url: url.slice(0, MAX_URL), path_words: pathWords(url.slice(0, MAX_URL)) },
      },
    },
    questions: bothOrders(
      'kind',
      choice(
        {
          task: 'Judge what kind of page `facts.link.url` is for a visitor of the site at `facts.link.site`.',
          answer_wanted: 'Pick the one page kind that fits best.',
          rules: [
            'Read the words in `facts.link.path_words`: they name what the page holds.',
          ],
        },
        menu('content', ['main', 'junk'], (k) => KINDS[k] ?? null),
      ),
    ),
  }),
  read: (a, t) => {
    const pick = agreedPick(a, 'kind', t)
    return isKind(pick) ? pick : undefined
  },
  bar: CONFIDENCE_BAR,
  fallback: kindBaseline,
  codeCheck: codeCheck,
  evals: 'tests/jev/evals/map.kind.json',
  docs: '88a6a003018eaea50167565a766a0d4a91d039cf93cc7dc2965d3ceba3a72caf',
})

// `urls` best-first by map.kind. The sort is stable, so ties, no key, and unsure
// answers keep the incoming order; the output is always a permutation.
// ponytail: only the first MAP_RANK_MAX URLs are judged (bounded calls); the
// rest keep their order after them. Batch per request if bigger lists matter.
const MAP_RANK_MAX = 256
const LEVEL: Record<Kind, number> = { junk: 0, content: 1, main: 2 }
interface OrderInput {
  readonly site: string
  readonly urls: ReadonlyArray<string>
}
export const mapOrder = Object.assign(
  ({ site, urls }: OrderInput) => {
    const head = urls.slice(0, MAP_RANK_MAX)
    return Effect.forEach(head, (url) => kindDecision({ site, url }), {
      concurrency: JEV_CONCURRENCY,
    }).pipe(
      Effect.map((kinds) => [
        ...head
          .map((url, i) => ({ url, level: LEVEL[kinds[i] ?? 'content'] }))
          .sort((a, b) => b.level - a.level)
          .map((r) => r.url),
        ...urls.slice(MAP_RANK_MAX),
      ]),
    )
  },
  { def: { fallback: ({ urls }: OrderInput): string[] => [...urls] } },
)
