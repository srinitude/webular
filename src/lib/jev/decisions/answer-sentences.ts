// answer.sentences: which sentences, after the lead, answer the reader's question?
// One call per answer asks one yes/no per candidate (they can co-occur, so no
// single-label Choice) plus an `any` companion that stands in for a none option.
// Kept sentences follow the lead; the summarizer fills the rest.
import { summarizeText } from '../../summarize.ts'
import { defineDecision } from '../define.ts'
import { CONFIDENCE_BAR, noul, purpose, sureYes } from '../payload/index.ts'
import { answerSentences } from './answer.ts'

const DOCS = '88a6a003018eaea50167565a766a0d4a91d039cf93cc7dc2965d3ceba3a72caf'
const MAX_SENTENCES = 18 // 18 candidate nouls + `any` per call
const MAX_QUESTION = 300
const MAX_SENTENCE = 600

interface Candidates {
  readonly question: string
  readonly candidates: ReadonlyArray<string>
}
// The question-aware summarizer's best sentences of `text`, in page order.
export const answerCandidates = (question: string, text: string) => {
  const all = answerSentences(text)
  const used = new Set<number>()
  for (const s of summarizeText(text, MAX_SENTENCES, { query: question }).sentences) {
    const i = all.findIndex((t, j) => t === s && !used.has(j))
    if (i >= 0) used.add(i)
  }
  return [...used].sort((a, b) => a - b).map((i) => all[i] ?? '')
}
const shown = ({ candidates }: Candidates) => candidates.slice(0, MAX_SENTENCES).map((_, i) => i)
const PURPOSE = purpose(
  'We answer a reader question with sentences taken from the web pages we fetched.',
  'Keep only the sentences that tell the reader something real that helps answer it.',
  'Word-count summaries keep menu, sign-up, and byline lines that tell the reader nothing.',
  'A sentence counts only when it states a fact itself; naming the topic is not enough.',
)
const payload = (input: Candidates) => {
  const keep = shown(input)
  return {
    state: {
      purpose: PURPOSE,
      facts: {
        question: { text: input.question.slice(0, MAX_QUESTION) },
        candidates: Object.fromEntries(
          keep.map((i) => [`c${i}`, (input.candidates[i] ?? '').slice(0, MAX_SENTENCE)]),
        ),
      },
    },
    questions: {
      ...Object.fromEntries(
        keep.map((i) => [
          `c${i}`,
          noul(
            `Does \`facts.candidates.c${i}\` state a fact that helps answer \`facts.question.text\`?`,
          ),
        ]),
      ),
      any: noul(
        'Does at least one entry of `facts.candidates` state a fact that helps answer `facts.question.text`?',
      ),
    },
  }
}

export const answerFollowers = defineDecision<Candidates, ReadonlyArray<number>>({
  name: 'answer.sentences',
  sample: () => ({
    question: 'What SQLite driver does Bun ship?',
    candidates: ['Bun is fast.', 'Bun ships a SQLite driver called bun:sqlite.'],
  }),
  subtasks: [
    { name: 'states', primitive: 'noul', pattern: 'fan-out', payload: { question: 'any' } },
  ],
  payload,
  // Sure yes on `any` and on at least one candidate, else the fallback decides.
  read: (a, t, input) => {
    if (sureYes(a['any'], t) !== true) return undefined
    const yes = shown(input).filter((i) => sureYes(a[`c${i}`], t) === true)
    return yes.length === 0 ? undefined : yes
  },
  bar: CONFIDENCE_BAR,
  // Keep none: the summarizer's top sentences follow the lead.
  fallback: () => [],
  // Every pick names one of the sentences Jev saw.
  codeCheck: (picked, input) => picked.every((i) => shown(input).includes(i)),
  evals: 'tests/jev/evals/answer.sentences.json',
  docs: DOCS,
})
