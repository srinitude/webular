// crawl: is a link worth following? Each decision in this folder is built with
// defineDecision: a payload builder (purpose, decisive facts, then context),
// typed questions, a reader at the 0.95 bar, a code check after the pick, and a
// rule-based fallback. Below the bar, with no key, or on any error, it returns
// its fallback.
import { Effect } from 'effect'
import { JEV_CONCURRENCY } from '../client.ts'
import { defineDecision } from '../define.ts'
import { CONFIDENCE_BAR, noul, purpose, sureYes } from '../payload/index.ts'

interface LinkCandidate {
  readonly url: string
  readonly anchor: string
}
const linkBaseline = (l: LinkCandidate): boolean =>
  !/\/(login|signin|signup|register|cart|privacy|terms|cookie|tag|share)\b|[?&](utm_|replytocom|sort=)|\.(jpg|png|gif|zip|pdf)$/i.test(
    l.url,
  )
const LINK_PURPOSE = purpose(
  'We crawl a site to collect the pages a reader needs.',
  'Follow only links that lead to real content about the goal.',
  'Every wasted fetch costs time and pushes good pages past the page limit.',
  'Links to login, cart, share, legal, tag lists, or tracking copies add no content.',
)
const LINK_QUESTIONS = {
  content: noul(
    'Does `link`, found on `crawl.from_page`, lead to a page with real content a reader of `crawl.goal` would want, not a login, cart, share, legal, or tracking page?',
  ),
}
interface LinkInput {
  readonly goal: string
  readonly page: { url: string; title: string }
  readonly link: LinkCandidate
}
export const linkDecision = defineDecision<LinkInput, boolean>({
  name: 'crawl.link',
  payload: ({ goal, page, link }) => ({
    state: {
      purpose: LINK_PURPOSE,
      link: { url: link.url, anchor_text: link.anchor },
      crawl: { goal, from_page: page },
    },
    questions: LINK_QUESTIONS,
  }),
  sample: () => ({
    goal: 'how to configure the Example CLI',
    page: { url: 'https://docs.example.dev/', title: 'Example docs' },
    link: { url: 'https://docs.example.dev/config', anchor: 'Configuration' },
  }),
  subtasks: [
    { name: 'content', primitive: 'noul', pattern: 'none', payload: { question: 'content' } },
  ],
  read: (a, t) => sureYes(a['content'], t),
  bar: CONFIDENCE_BAR,
  fallback: (i) => linkBaseline(i.link),
  // Never follow a link that is not http(s), whatever Jev says.
  codeCheck: (follow, i) => !follow || /^https?:\/\//i.test(i.link.url),
  evals: 'tests/jev/evals/crawl.link.json',
  docs: '88a6a003018eaea50167565a766a0d4a91d039cf93cc7dc2965d3ceba3a72caf',
})
export const linkWorthFollowing = (
  goal: string,
  page: { url: string; title: string },
  links: ReadonlyArray<LinkCandidate>,
) =>
  Effect.forEach(links, (link) => linkDecision({ goal, page, link }), {
    concurrency: JEV_CONCURRENCY,
  })
