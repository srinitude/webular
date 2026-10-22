// answer citation: does a cited source back an answer sentence? A word-for-word
// copy stays supported; Jev acts only when both option orders agree at the 0.95
// bar on a known verdict, and otherwise the baseline stands.
import { Effect } from 'effect'
import { defineDecision } from '../define.ts'
import { agreedPick, bothOrders, CONFIDENCE_BAR, choice, menu, purpose } from '../payload/index.ts'

const DOCS = 'b0b26ab933a61b5d43ccccae5fbd009f445bfdcfd2808cac9e410a84f0fd8ca4'
const MAX_CLAIM = 600
const MAX_SOURCE = 2_000

type Verdict = 'supported' | 'contradicted' | 'not_addressed'
const VERDICTS: ReadonlyArray<string> = ['supported', 'contradicted', 'not_addressed']
interface Source {
  readonly title: string
  readonly text: string
}
interface CitationInput {
  readonly claim: string
  readonly source: Source
}

const squash = (s: string) =>
  s
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?]+$/, '')
    .toLowerCase()

// Baseline: a sentence copied word for word from its source is supported;
// anything else is not addressed. It never spots a contradiction.
const citationBaseline = ({ claim, source }: CitationInput): Verdict =>
  squash(source.text).includes(squash(claim)) ? 'supported' : 'not_addressed'

const CITATION_PURPOSE = purpose(
  'Every sentence in our answer cites a web page.',
  'Each sentence ships only with a page that backs it.',
  'A citation that does not back its sentence breaks trust in the whole answer.',
  'Sentences may reword the page. A page on the same topic can still leave the fact out or say the opposite.',
)
const VERDICT_TEXT: Record<string, string> = {
  supported: 'Only when it states the same fact as the claim, in the same or other words',
  contradicted: 'Only when it states a fact that conflicts with the claim',
  not_addressed: 'It does not state this fact either way',
}

const citationPayload = ({ claim, source }: CitationInput) => ({
  state: {
    purpose: CITATION_PURPOSE,
    facts: {
      claim: { text: claim.slice(0, MAX_CLAIM) },
      source: { title: source.title, text: source.text.slice(0, MAX_SOURCE) },
    },
  },
  // Asked in both option orders (position check); the baseline's own verdict comes first.
  questions: bothOrders(
    'verdict',
    choice(
      'What does `facts.source.text` of the page titled `facts.source.title` say about `facts.claim.text`?',
      menu('not_addressed', VERDICTS, (k) => VERDICT_TEXT[k] ?? null),
    ),
  ),
})

// A known verdict only; a word-for-word copy never leaves supported.
const citationCodeCheck = (v: Verdict, input: CitationInput) =>
  VERDICTS.includes(v) && (citationBaseline(input) !== 'supported' || v === 'supported')

export const answerCitation = defineDecision<CitationInput, Verdict>({
  name: 'answer.citation',
  sample: () => ({
    claim: 'Sydney is the capital of Australia.',
    source: {
      title: 'Australia',
      text: 'Canberra is the capital of Australia, chosen in 1908 as a compromise between Sydney and Melbourne.',
    },
  }),
  subtasks: [
    {
      name: 'verdict',
      primitive: 'choice',
      pattern: 'confidence-routing',
      payload: { question: 'verdict' },
    },
  ],
  payload: citationPayload,
  read: (a, t) => agreedPick(a, 'verdict', t) as Verdict | undefined,
  bar: CONFIDENCE_BAR,
  fallback: citationBaseline,
  codeCheck: citationCodeCheck,
  evals: 'tests/jev/evals/answer.citation.json',
  docs: DOCS,
})

// Sources that back at least one answer sentence; when none does, every source
// stays cited, as in the baseline.
export const citedSources = <S extends Source>(
  sentences: ReadonlyArray<string>,
  sources: ReadonlyArray<S>,
  check: (c: CitationInput) => Effect.Effect<Verdict>,
) =>
  Effect.filter(
    sources,
    (source) =>
      Effect.forEach(sentences, (claim) => check({ claim, source }), { concurrency: 8 }).pipe(
        Effect.map((vs) => vs.includes('supported')),
      ),
    { concurrency: 2 },
  ).pipe(Effect.map((kept) => (kept.length > 0 ? kept : [...sources])))
