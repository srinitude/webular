// Jev Choice picks for the extraction helper and the feed workflow. Each falls
// back to its rule-based baseline. Options are capped at CAPS.fields, so a page
// with many feeds or extractors still makes one bounded request.
import { defineDecision } from './define.ts'
import {
  agreedPick,
  bothOrders,
  CAPS,
  CONFIDENCE_BAR,
  choice,
  menu,
  purpose,
} from './payload/index.ts'

const EXTRACT_PURPOSE = purpose(
  'We turn a web page into clean text for a reader or a model.',
  'Pick the output that keeps the main content and drops menus, ads, and footers.',
  'Missing content loses facts; extra boilerplate buries them.',
  'Each output came from a different extractor run on the same page.',
)
interface ExtractInput {
  readonly url: string
  readonly outputs: Readonly<Record<string, string>>
  readonly names: ReadonlyArray<string>
}
// Baseline: the longest output.
const longest = ({ outputs, names }: ExtractInput) =>
  names.reduce(
    (a, b) => ((outputs[b]?.length ?? 0) > (outputs[a]?.length ?? 0) ? b : a),
    names[0] ?? '',
  )
export const extractDecision = defineDecision<ExtractInput, string>({
  name: 'extract.pick',
  sample: () => ({
    url: 'https://docs.example.dev/config',
    outputs: {
      readability: 'Configure the CLI with a config file.',
      raw: 'Menu Home Configure the CLI.',
    },
    names: ['readability', 'raw'],
  }),
  subtasks: [
    {
      name: 'best',
      primitive: 'choice',
      pattern: 'confidence-routing',
      payload: { question: 'best' },
    },
  ],
  payload: ({ url, outputs, names: all }) => {
    const names = all.slice(0, CAPS.fields)
    return {
      state: {
        purpose: EXTRACT_PURPOSE,
        outputs: Object.fromEntries(names.map((n) => [n, outputs[n]?.slice(0, 4_000) ?? ''])),
        page: { url },
      },
      // Asked in both option orders (position check); the rule's pick, the
      // longest output, is the default and comes first in the main order.
      questions: bothOrders(
        'best',
        choice(
          'Which entry of `outputs`, all taken from the page at `page.url`, keeps the most main content with the least menu, ad, or footer text?',
          menu(longest({ url, outputs, names }), names),
        ),
      ),
    }
  },
  read: (a, t, i) => agreedPick(a, 'best', t) ?? longest(i),
  bar: CONFIDENCE_BAR,
  fallback: longest,
  // The pick must be one of the extractors that ran.
  codeCheck: (name, i) => i.names.includes(name),
  evals: 'tests/jev/evals/extract.pick.json',
  docs: '88a6a003018eaea50167565a766a0d4a91d039cf93cc7dc2965d3ceba3a72caf',
})

const FEED_PURPOSE = purpose(
  'We find the feed of a site so a reader can follow it.',
  'Pick the main feed of posts, not a comments feed or a single tag.',
  'A wrong feed gives the reader the wrong stream.',
  'Sites often list a posts feed, a comments feed, and per-tag feeds.',
)
interface FeedInput {
  readonly site: string
  readonly candidates: ReadonlyArray<{ url: string; title: string }>
}
// Baseline: the first candidate.
const firstFeed = ({ candidates }: FeedInput) => candidates[0]?.url ?? ''
export const feedDecision = defineDecision<FeedInput, string>({
  name: 'feed.pick',
  sample: () => ({
    site: 'https://blog.example.dev',
    candidates: [
      { url: 'https://blog.example.dev/comments/feed', title: 'Comments feed' },
      { url: 'https://blog.example.dev/feed', title: 'Posts feed' },
    ],
  }),
  subtasks: [
    {
      name: 'main',
      primitive: 'choice',
      pattern: 'confidence-routing',
      payload: { question: 'main' },
    },
  ],
  payload: ({ site, candidates: all }) => {
    const candidates = all.slice(0, CAPS.fields - 1)
    return {
      state: { purpose: FEED_PURPOSE, candidates, site },
      // Asked in both option orders (position check).
      questions: bothOrders(
        'main',
        choice(
          'Which entry of `candidates` is the main posts feed of `site`?',
          menu(
            firstFeed({ site, candidates }),
            candidates.map((c) => c.url),
            (k) =>
              k === 'none'
                ? 'Only when no entry is a feed of posts'
                : (candidates.find((c) => c.url === k)?.title ?? null),
          ),
        ),
      ),
    }
  },
  read: (a, t, i) => agreedPick(a, 'main', t) ?? firstFeed(i),
  bar: CONFIDENCE_BAR,
  fallback: firstFeed,
  // The pick must be one of the candidate feeds.
  codeCheck: (url, i) => i.candidates.some((c) => c.url === url),
  evals: 'tests/jev/evals/feed.pick.json',
  docs: '88a6a003018eaea50167565a766a0d4a91d039cf93cc7dc2965d3ceba3a72caf',
})
