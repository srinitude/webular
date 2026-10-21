// Jev fetch decision: does a static fetch need the browser? Same shape as fetch.ts.
import { Effect } from 'effect'
import { withinJevBudget } from './budget.ts'
import { defineDecision } from './define.ts'
import {
  agreed,
  bothOrders,
  CHALLENGE,
  DOCS,
  MAX_BODY,
  mainText,
  type Options,
  SUBTASKS,
  scriptCount,
  scriptSources,
  visibleText,
} from './fetch-page.ts'
import { CONFIDENCE_BAR, NONE_OPTION, purpose } from './payload/index.ts'

interface Page {
  readonly url: string
  readonly html: string
}

// ── does a static fetch need the browser? ──
const BROWSER_KINDS = ['static_ok', 'js_shell', 'bot_challenge'] as const
type BrowserKind = (typeof BROWSER_KINDS)[number]
const browserBaseline = ({ html }: Page): BrowserKind =>
  CHALLENGE.test(html)
    ? 'bot_challenge'
    : visibleText(html).length < 200 && scriptCount(html) > 0
      ? 'js_shell'
      : 'static_ok'
const BROWSER_OPTIONS: Options = [
  ['static_ok', 'The HTML already holds the readable content.'],
  ['js_shell', 'An empty app shell; scripts build the content.'],
  ['bot_challenge', 'A bot check that only a real browser can pass.'],
  [NONE_OPTION, 'None of these fit the HTML.'],
]
const browserState = ({ url, html }: Page) => {
  const text = visibleText(html)
  return {
    purpose: purpose(
      'We fetch pages without a browser first, since it is fast.',
      'Open the browser only when the plain HTML lacks the content.',
      'The browser is slow; skipping it on a shell page loses the content.',
      'Single-page apps send a near-empty body; bot checks send a challenge page. Menus, footers, and a Loading note are not content. Analytics scripts do not build content.',
    ),
    page: {
      url,
      visible_text: text.slice(0, MAX_BODY),
      visible_chars: text.length,
      main_text_without_menus: mainText(html).slice(0, MAX_BODY),
      script_tags: scriptCount(html),
      script_sources: scriptSources(html),
    },
  }
}
export const fetchBrowserDecision = defineDecision<Page, BrowserKind>({
  name: 'fetch.browser',
  payload: (p) => ({
    state: browserState(p),
    questions: bothOrders('What does the HTML in `page` hold?', BROWSER_OPTIONS),
  }),
  sample: () => ({
    url: 'https://app.example.dev/',
    html: '<div id="root">Loading...</div><script src="/app.js"></script>',
  }),
  subtasks: SUBTASKS,
  read: (a, bar) => agreed(a, bar, BROWSER_KINDS),
  bar: CONFIDENCE_BAR,
  fallback: browserBaseline,
  // A page with lots of text is no app shell.
  codeCheck: (k, { html }) => !(k === 'js_shell' && visibleText(html).length > 1_500),
  evals: 'tests/jev/evals/fetch.browser.json',
  docs: DOCS,
})
// A page with no script tags, or with 5,000 visible chars, is no shell or bot
// check, so it skips Jev. ponytail: a script-free challenge page stays static.
export const needsBrowser = (url: string, html: string, timeoutMs: number) =>
  visibleText(html).length >= 5_000 || scriptCount(html) === 0
    ? Effect.succeed(false)
    : withinJevBudget(timeoutMs, fetchBrowserDecision({ url, html }), () =>
        browserBaseline({ url, html }),
      ).pipe(Effect.map((k) => k !== 'static_ok'))
