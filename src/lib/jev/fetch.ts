// Jev fetch decisions: what to do after a failed response, whether a 200 page is
// really a block, and whether a static fetch needs the browser. Each asks one
// Choice in both option orders in one request; it acts only when both orders
// agree at the 0.95 bar and the code check passes. Otherwise the code rule decides.
// Each runs inside withinJevBudget, so Jev never takes more than half the fetch timeout.
// fetch-browser.ts holds the browser decision.
import { Effect } from 'effect'
import { withinJevBudget } from './budget.ts'
import { defineDecision } from './define.ts'
import {
  agreed,
  bothOrders,
  DOCS,
  MAX_BODY,
  type Options,
  SUBTASKS,
  visibleText,
} from './fetch-page.ts'
import { CONFIDENCE_BAR, NONE_OPTION, purpose } from './payload/index.ts'

interface FetchedPage {
  readonly url: string
  readonly status: number
  readonly retryAfter?: string
  readonly body: string
}
interface Page {
  readonly url: string
  readonly html: string
}

// ── classify a non-2xx response into its next action ──
const NEXT_ACTIONS = [
  'retry_later',
  'escalate_browser',
  'try_archive',
  'needs_login',
  'give_up',
] as const
type NextAction = (typeof NEXT_ACTIONS)[number]
const RETRYABLE = [408, 425, 429, 500, 502, 503, 504]
const errorBaseline = (p: FetchedPage): NextAction =>
  RETRYABLE.includes(p.status)
    ? 'retry_later'
    : p.status === 401 || p.status === 407
      ? 'needs_login'
      : p.status === 403
        ? 'escalate_browser'
        : p.status === 404 || p.status === 410
          ? 'try_archive'
          : 'give_up'
const ERROR_OPTIONS: Options = [
  ['retry_later', 'A short outage or rate limit; the same request should work later.'],
  ['escalate_browser', 'A bot wall or JavaScript check that a real browser can pass.'],
  ['try_archive', 'The page is gone or blocked for good; an archived copy may still exist.'],
  ['needs_login', 'The page needs the user to sign in or pay.'],
  ['give_up', 'The request itself is wrong; nothing will make it work.'],
  [NONE_OPTION, 'None of these fit the response.'],
]
const errorState = (p: FetchedPage) => ({
  purpose: purpose(
    'We fetch web pages for a reader. This fetch did not return a page.',
    'Pick the one next step that most likely gets the page.',
    'The wrong step wastes time or gives up on a page we could get.',
    'Status codes often mislead: some sites send 403 for bot walls and 404 for login pages. Text that asks the reader to sign in, log in, or subscribe means a login is needed, whatever the status.',
  ),
  response: {
    url: p.url,
    status: p.status,
    retry_after: p.retryAfter ?? null,
    body: visibleText(p.body).slice(0, MAX_BODY),
  },
})
export const fetchErrorDecision = defineDecision<FetchedPage, NextAction>({
  name: 'fetch.error',
  payload: (p) => ({
    state: errorState(p),
    questions: bothOrders('Which next step fits `response` best?', ERROR_OPTIONS),
  }),
  sample: () => ({
    url: 'https://news.example.dev/story',
    status: 403,
    body: '<p>Please sign in to keep reading.</p>',
  }),
  subtasks: SUBTASKS,
  read: (a, bar) => agreed(a, bar, NEXT_ACTIONS),
  bar: CONFIDENCE_BAR,
  fallback: errorBaseline,
  // The pick must fit the status class.
  codeCheck: (a, p) =>
    a === 'retry_later'
      ? RETRYABLE.includes(p.status) || p.status >= 500
      : a === 'needs_login'
        ? [401, 403, 404, 407].includes(p.status)
        : true,
  evals: 'tests/jev/evals/fetch.error.json',
  docs: DOCS,
})
export const classifyHttpError = (p: FetchedPage, timeoutMs: number) =>
  withinJevBudget(timeoutMs, fetchErrorDecision(p), () => errorBaseline(p))

// ── is a 200 page really a block page, captcha, consent wall, or soft 404? ──
const BLOCK_KINDS = ['real_content', 'block_page', 'captcha', 'consent_wall', 'soft_404'] as const
type BlockKind = (typeof BLOCK_KINDS)[number]
const BLOCK_OPTIONS: Options = [
  ['real_content', 'The page shows the real article, product, or document.'],
  ['block_page', 'An access-denied or blocked page.'],
  ['captcha', 'A captcha or are-you-human check.'],
  ['consent_wall', 'A cookie or consent wall hides the content.'],
  ['soft_404', 'A not-found or empty page sent with status 200.'],
  [NONE_OPTION, 'None of these fit the page.'],
]
const blockState = ({ url, html }: Page) => {
  const text = visibleText(html)
  return {
    purpose: purpose(
      'We fetch web pages for a reader. This one came back 200 OK.',
      'Tell real content apart from pages that only stand in for it.',
      'A block page saved as content gives the reader junk.',
      'Many sites send 200 with a captcha, a cookie wall, or a not-found message.',
    ),
    page: { url, visible_text: text.slice(0, MAX_BODY), visible_chars: text.length },
  }
}
export const fetchBlockDecision = defineDecision<Page, BlockKind>({
  name: 'fetch.block',
  payload: (p) => ({
    state: blockState(p),
    questions: bothOrders('What does `page` show?', BLOCK_OPTIONS),
  }),
  sample: () => ({
    url: 'https://shop.example.dev/item',
    html: '<h1>Just a moment...</h1><p>Verify you are human to continue.</p>',
  }),
  subtasks: SUBTASKS,
  read: (a, bar) => agreed(a, bar, BLOCK_KINDS),
  bar: CONFIDENCE_BAR,
  // Baseline: the fetch path accepts every 200 page as content.
  fallback: () => 'real_content',
  // A long page is never only a captcha or consent wall.
  codeCheck: (k, { html }) =>
    !((k === 'captcha' || k === 'consent_wall') && visibleText(html).length > 5_000),
  evals: 'tests/jev/evals/fetch.block.json',
  docs: DOCS,
})
export const isSoftBlock = (url: string, html: string, timeoutMs: number) =>
  withinJevBudget(timeoutMs, fetchBlockDecision({ url, html }), () => 'real_content').pipe(
    Effect.map((k) => k !== 'real_content'),
  )
