// scrape: does the readability article or the whole page hold the main content?
// The rule keeps the article whenever readability found one.
import { defineDecision } from '../define.ts'
import { agreedPick, bothOrders, CONFIDENCE_BAR, choice, menu, purpose } from '../payload/index.ts'

interface MainInput {
  readonly url: string
  readonly article: string
  readonly page: string
}
type Main = 'article' | 'page'
const MAX_TEXT = 12_000 // keeps the request under the 64k cap with both texts
const mainBaseline = ({ article }: MainInput): Main => (article.trim() ? 'article' : 'page')

const MAIN_PURPOSE = purpose(
  'We turn a web page into clean Markdown for a reader or a model.',
  'The result keeps the main content and drops menus, ads, and footers.',
  'Missing content loses facts; extra boilerplate buries them.',
  'The article is what a readability pass kept; it can miss the content or keep only a banner.',
)
const DESCRIBE: Record<string, string> = {
  article: 'The readability article in `facts.texts.article` holds the main content',
  page: 'Only when `facts.texts.article` misses the main content that `facts.texts.page` holds',
  none: 'Only when neither text holds any main content',
}

export const mainDecision = defineDecision<MainInput, Main>({
  name: 'scrape.main',
  sample: () => ({
    url: 'https://docs.example.dev/config',
    article: 'Configure the CLI with a config file named webular.json.',
    page: 'Home Docs Pricing Configure the CLI with a config file named webular.json. Footer',
  }),
  subtasks: [
    {
      name: 'main',
      primitive: 'choice',
      pattern: 'confidence-routing',
      payload: { question: 'main' },
    },
  ],
  payload: (input) => ({
    state: {
      purpose: MAIN_PURPOSE,
      facts: {
        page: { url: input.url, default: mainBaseline(input) },
        texts: { article: input.article.slice(0, MAX_TEXT), page: input.page.slice(0, MAX_TEXT) },
      },
    },
    // Asked in both option orders (position check); the rule's pick comes first.
    questions: bothOrders(
      'main',
      choice(
        'Which text, taken from the page at `facts.page.url`, keeps its main content with the least menu, ad, or footer text?',
        menu(mainBaseline(input), ['article', 'page'], (k) => DESCRIBE[k] ?? null),
      ),
    ),
  }),
  read: (a, t) => {
    const pick = agreedPick(a, 'main', t)
    return pick === 'article' || pick === 'page' ? pick : undefined
  },
  bar: CONFIDENCE_BAR,
  fallback: mainBaseline,
  // The pick must name a text that is not empty.
  codeCheck: (pick, input) => input[pick].trim() !== '',
  evals: 'tests/jev/evals/scrape.main.json',
  docs: '88a6a003018eaea50167565a766a0d4a91d039cf93cc7dc2965d3ceba3a72caf',
})
