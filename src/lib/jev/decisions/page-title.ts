// page title: which title candidate names the page's main content. The rule
// (Readability's title, else <title>) decides below 0.95.
import type { JevRequest } from '../client.ts'
import { defineDecision } from '../define.ts'
import { agreedPick, bothOrders, CONFIDENCE_BAR, choice, menu, purpose } from '../payload/index.ts'

export interface TitleCandidates {
  readonly readability: string
  readonly document: string
  readonly og: string
  readonly h1: string
}
interface TitleInput {
  readonly url: string
  readonly candidates: TitleCandidates
}
type Key = keyof TitleCandidates
const KEYS: ReadonlyArray<Key> = ['readability', 'document', 'og', 'h1']
const MAX_TITLE = 300

const baselineKey = ({ candidates }: TitleInput): Key =>
  candidates.readability ? 'readability' : 'document'
export const titleBaseline = (input: TitleInput): string => input.candidates[baselineKey(input)]

const TITLE_PURPOSE = purpose(
  'webular reads a web page and shows its title above the text.',
  'Show the title a reader would expect for this page.',
  'A wrong title names a menu, a cookie banner, or the site instead of the page.',
  'Readability, the <title> tag, og:title, and the first h1 each guess the title; any of them can be noise.',
)
const ASK =
  'Which option is the title a reader would expect for the page at `facts.page.url`? Each option is a title guess; prefer a clean title over one with a site name added. Pick none when every guess is a menu word, a banner, or only the site name.'

// Each option is the title text itself, so Jev judges the words, not a source name.
const optionOf = (input: TitleInput, k: Key): string =>
  input.candidates[k].trim().slice(0, MAX_TITLE)
const titlePayload = (input: TitleInput): JevRequest => {
  // Non-empty, distinct texts, so Jev never splits its confidence between copies.
  const options = [...new Set(KEYS.map((k) => optionOf(input, k)).filter(Boolean))]
  const first = optionOf(input, baselineKey(input)) || (options[0] ?? '')
  // Both option orders (position check); the rule's pick comes first.
  return {
    state: { purpose: TITLE_PURPOSE, facts: { page: { url: input.url } } },
    questions: bothOrders('title', choice(ASK, menu(first, options))),
  }
}

export const titleDecision = defineDecision<TitleInput, string>({
  name: 'page.title',
  sample: () => ({
    url: 'https://www.kingarthurbaking.com/recipes/sourdough-bread-recipe',
    candidates: {
      readability: 'Menu',
      document: 'Sourdough Bread Recipe | King Arthur Baking',
      og: 'Sourdough Bread Recipe',
      h1: 'Sourdough Bread',
    },
  }),
  subtasks: [
    {
      name: 'title',
      primitive: 'choice',
      pattern: 'confidence-routing',
      payload: { question: 'title' },
    },
  ],
  payload: titlePayload,
  read: (a, bar, input) => {
    const pick = agreedPick(a, 'title', bar)
    const key = KEYS.find((k) => pick !== undefined && optionOf(input, k) === pick)
    return key ? input.candidates[key] : undefined
  },
  bar: CONFIDENCE_BAR,
  fallback: titleBaseline,
  codeCheck: (pick, input) => pick.trim() !== '' && KEYS.some((k) => input.candidates[k] === pick),
  evals: 'tests/jev/evals/page.title.json',
  docs: '88a6a003018eaea50167565a766a0d4a91d039cf93cc7dc2965d3ceba3a72caf',
})
