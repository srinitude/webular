// monitor: does a page diff matter to the watcher?
import type { JevAnswer } from '../client.ts'
import { defineDecision } from '../define.ts'
import { CAPS, CONFIDENCE_BAR, noul, purpose, sureYes } from '../payload/index.ts'

// Baseline: some changed line holds more than digits and punctuation.
const changeBaseline = (diff: string): boolean =>
  diff
    .split('\n')
    .filter((l) => /^[+-][^+-]/.test(l))
    .some((l) => !/^[\d\s:/.,-]*$/.test(l.slice(1)))
const CHANGE_PURPOSE = purpose(
  'A person asked us to watch one web page and tell them when it changes in a way they care about.',
  'Alert on changes to what the page says or offers, such as a price, stock status, a limit, or a rule. Stay quiet on noise.',
  'A false alert teaches the person to ignore alerts; a missed alert loses the one change they asked about.',
  'Pages rewrite dates, timestamps, view counts, session ids, copyright years, and ad text all the time; those are noise.',
)
// Measured: one compound noise question scored 0.625 on the change eval; one
// Noul per noise kind scored 0.375, so the compound question stays.
const CHANGE_QUESTIONS = {
  noise: noul(
    'Do the lines in `change.added` differ from the lines in `change.removed` only in a date, a timestamp, a view or visitor count, a session or tracking id, a copyright year, or ad or sponsor text?',
  ),
  matters: noul(
    'Do the lines in `change.added` change what the page at `page.url` says or offers, compared with `change.removed`, in a way a person watching for `page.watch_for` would want to know?',
  ),
}
// Decisive facts first: the removed and added lines, split from the diff.
// The diff is cut to CAPS.chars before the split, so the work stays flat.
const changedLines = (diff: string, sign: '+' | '-') =>
  diff
    .slice(0, CAPS.chars)
    .split('\n')
    .filter((l) => l.startsWith(sign) && !l.startsWith(sign.repeat(3)))
    .slice(0, CAPS.fields)
    .map((l) => l.slice(1))
// Noise wins first; then a sure answer on meaning; else the code rule.
const readChange = (a: Record<string, JevAnswer>, t: number): boolean | undefined => {
  const noise = sureYes(a['noise'], t)
  if (noise === true) return false
  const matters = sureYes(a['matters'], t)
  if (matters !== undefined) return matters
  return noise === false ? true : undefined
}
interface ChangeInput {
  readonly url: string
  readonly watchFor: string
  readonly diff: string
}
export const changeDecision = defineDecision<ChangeInput, boolean>({
  name: 'monitor.change',
  payload: ({ url, watchFor, diff }) => ({
    state: {
      purpose: CHANGE_PURPOSE,
      change: { removed: changedLines(diff, '-'), added: changedLines(diff, '+') },
      page: { url, watch_for: watchFor || 'any change in what the page says or offers' },
    },
    questions: CHANGE_QUESTIONS,
  }),
  sample: () => ({
    url: 'https://shop.example.dev/plan',
    watchFor: 'price',
    diff: '-Price: $49 per month\n+Price: $59 per month',
  }),
  subtasks: [
    {
      name: 'noise',
      primitive: 'noul',
      pattern: 'confidence-routing',
      payload: { question: 'noise' },
    },
    {
      name: 'matters',
      primitive: 'noul',
      pattern: 'confidence-routing',
      payload: { question: 'matters' },
    },
  ],
  read: readChange,
  bar: CONFIDENCE_BAR,
  fallback: (i) => changeBaseline(i.diff),
  // An alert needs at least one changed line.
  codeCheck: (alert, i) =>
    !alert || changedLines(i.diff, '+').length + changedLines(i.diff, '-').length > 0,
  evals: 'tests/jev/evals/monitor.change.json',
  docs: '88a6a003018eaea50167565a766a0d4a91d039cf93cc7dc2965d3ceba3a72caf',
})
