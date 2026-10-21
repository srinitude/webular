// extract: which page element holds a named field? Code builds the candidate
// elements, Jev picks one id (asked in both option orders), and code copies that
// element's text verbatim. extract.field runs when no selector was given (rule:
// the first element whose hint names the field); extract.recover runs when the
// selector matched zero or several elements (rule: the first match, or '').
import type { JevAnswer } from '../client.ts'
import { defineDecision } from '../define.ts'
import { agreedPick, bothOrders, CONFIDENCE_BAR, choice, menu, purpose } from '../payload/index.ts'

export interface Candidate {
  readonly tag: string
  readonly hint: string
  readonly text: string
}
interface FieldInput {
  readonly name: string
  readonly candidates: ReadonlyArray<Candidate>
}
interface RecoverInput extends FieldInput {
  readonly selector: string
  // True when the candidates are the selector's own matches, false when it matched none.
  readonly matched: boolean
}
const MAX_TEXT = 200

const hintRule = ({ name, candidates }: FieldInput) =>
  candidates.find((c) => c.hint.toLowerCase().includes(name.toLowerCase()))?.text ?? ''
const recoverRule = ({ matched, candidates }: RecoverInput) =>
  matched ? (candidates[0]?.text ?? '') : ''

const EXTRACT_PURPOSE = purpose(
  'We pull named fields out of a web page, like a price or a title.',
  'The reader gets the one element whose text is the value of the field.',
  'The wrong element puts a wrong value in the reader data.',
  'Pages hold many text bits: menus, labels, ads, and related items.',
)

const describe = (k: string) =>
  k === 'none' ? 'Only when no element holds this field' : `Element \`candidates.${k}\``

const payload = (input: FieldInput, rule: string, selector?: string) => {
  const ids = input.candidates.map((_, i) => `e${i}`)
  const first = ids[input.candidates.findIndex((c) => c.text === rule)] ?? ids[0] ?? 'e0'
  return {
    state: {
      purpose: EXTRACT_PURPOSE,
      field: { name: input.name, selector: selector ?? '', default: rule || 'none' },
      candidates: Object.fromEntries(
        input.candidates.map((c, i) => [
          `e${i}`,
          { tag: c.tag, hint: c.hint, text: c.text.slice(0, MAX_TEXT) },
        ]),
      ),
    },
    // Asked in both option orders (position check); the rule's pick comes first.
    questions: bothOrders(
      'field',
      choice(
        'Which entry of `candidates` has text that is the value of the field `field.name`? `field.selector` is the CSS selector the user gave, empty when none; `field.default` is the text the code rule found.',
        menu(first, ids, describe),
      ),
    ),
  }
}

// The agreed element's full text; an agreed `none` means the field is empty.
const read = (a: Record<string, JevAnswer>, t: number, input: FieldInput) => {
  const pick = agreedPick(a, 'field', t)
  if (pick === undefined) return undefined
  if (pick === 'none') return ''
  return input.candidates[Number(pick.slice(1))]?.text
}
// The pick is empty or one candidate's text, copied verbatim.
const codeCheck = (v: string, input: FieldInput) =>
  v === '' || input.candidates.some((c) => c.text === v)

const SUBTASKS = [
  {
    name: 'field',
    primitive: 'choice',
    pattern: 'confidence-routing',
    payload: { question: 'field' },
  },
] as const
const DOCS = '88a6a003018eaea50167565a766a0d4a91d039cf93cc7dc2965d3ceba3a72caf'
const SAMPLE: ReadonlyArray<Candidate> = [
  { tag: 'a', hint: 'nav', text: 'Pricing' },
  { tag: 'span', hint: 'product-price', text: '$19.99' },
]

export const fieldDecision = defineDecision<FieldInput, string>({
  name: 'extract.field',
  sample: () => ({ name: 'price', candidates: SAMPLE }),
  subtasks: SUBTASKS,
  payload: (input) => payload(input, hintRule(input)),
  read,
  bar: CONFIDENCE_BAR,
  fallback: hintRule,
  codeCheck: codeCheck,
  evals: 'tests/jev/evals/extract.field.json',
  docs: DOCS,
})

export const recoverDecision = defineDecision<RecoverInput, string>({
  name: 'extract.recover',
  sample: () => ({ name: 'price', selector: '.cost', matched: false, candidates: SAMPLE }),
  subtasks: SUBTASKS,
  payload: (input) => payload(input, recoverRule(input), input.selector),
  read,
  bar: CONFIDENCE_BAR,
  fallback: recoverRule,
  codeCheck: codeCheck,
  evals: 'tests/jev/evals/extract.recover.json',
  docs: DOCS,
})
