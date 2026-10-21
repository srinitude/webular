// search intent: which kind of question a web search is, so the chain asks the
// keyless sources that answer that kind. The keyword rule decides below 0.95.
import { defineDecision } from '../define.ts'
import { agreedPick, bothOrders, CONFIDENCE_BAR, choice, menu, purpose } from '../payload/index.ts'

export type Intent = 'general' | 'scholarly' | 'software'
interface IntentInput {
  readonly query: string
}
const INTENTS: ReadonlyArray<Intent> = ['general', 'scholarly', 'software']
const MAX_QUERY = 300

// "survey" stays out: land surveys (Everest 2020) are factual, not scholarly.
const SCHOLARLY =
  /\b(paper|papers|study|studies|research|journal|doi|arxiv|preprint|theorem|citations?)\b/i
// Navigational software queries also ask npm, whose package homepages are
// official sites the other free APIs never return.
const SOFTWARE = /\b(official|website|homepage|docs?|documentation|library|framework|github|npm)\b/i
export const intentBaseline = ({ query }: IntentInput): Intent =>
  SCHOLARLY.test(query) ? 'scholarly' : SOFTWARE.test(query) ? 'software' : 'general'

const INTENT_PURPOSE = purpose(
  'We answer a web search from free keyless sources.',
  'Ask the sources that hold answers for this kind of question.',
  'A scholarly question needs paper indexes; a software question needs package registries.',
  'Words like paper, library, or research also show up in everyday questions about shops, places, and products.',
)
const DESCRIBE: Record<string, string> = {
  general:
    'Everyday facts, news, people, places, products, or shopping, like `height of mount everest` or `paper towel prices`',
  scholarly:
    'Only when the query asks for research papers, studies, trials, or academic findings, like `CRISPR off-target effects in embryos`',
  software:
    'Only when the query is about a code library, package, framework, or developer tool, like `how to install zod`',
  none: 'Only when the query has no meaning at all',
}

export const intentDecision = defineDecision<IntentInput, Intent>({
  name: 'search.intent',
  sample: () => ({ query: 'how to install zod' }),
  subtasks: [
    {
      name: 'intent',
      primitive: 'choice',
      pattern: 'intent-routing',
      payload: { question: 'intent' },
    },
  ],
  payload: (input) => ({
    state: {
      purpose: INTENT_PURPOSE,
      facts: {
        search: { query: input.query.slice(0, MAX_QUERY), default: intentBaseline(input) },
      },
    },
    // Asked in both option orders (position check); the rule's pick comes first.
    questions: bothOrders(
      'intent',
      choice(
        'What kind of question is the web search in `facts.search.query`?',
        menu(intentBaseline(input), INTENTS, (k) => DESCRIBE[k] ?? null),
      ),
    ),
  }),
  read: (a, bar) => {
    const pick = agreedPick(a, 'intent', bar)
    return INTENTS.find((i) => i === pick)
  },
  bar: CONFIDENCE_BAR,
  fallback: intentBaseline,
  codeCheck: (pick) => INTENTS.includes(pick),
  evals: 'tests/jev/evals/search.intent.json',
  docs: '88a6a003018eaea50167565a766a0d4a91d039cf93cc7dc2965d3ceba3a72caf',
})
