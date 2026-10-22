// research.sentences: which sentences of one source state a fact about the research
// topic? One call per source asks one yes/no per candidate (they can co-occur, so
// no single-label Choice) plus an `any` companion that stands in for a none option.
// Kept sentences open the report section; the summarizer fills the rest.
import { splitResearchSentences, summarizeText } from '../../summarize.ts'
import { defineDecision } from '../define.ts'
import { CONFIDENCE_BAR, noul, purpose, sureYes } from '../payload/index.ts'

const DOCS = '88a6a003018eaea50167565a766a0d4a91d039cf93cc7dc2965d3ceba3a72caf'
const MAX_SENTENCES = 18 // 18 candidate nouls + `any` per call
const MAX_TOPIC = 300
const MAX_SENTENCE = 600

// Research ranks and indexes sentences from its own splitter, not the summarizer's default.
export const researchSentences = (text: string, topN = Number.POSITIVE_INFINITY, topic?: string) =>
  summarizeText(
    text,
    topN,
    topic === undefined ? undefined : { query: topic },
    splitResearchSentences,
  ).sentences

interface SourceText {
  readonly topic: string
  readonly text: string
}
// The topic-aware summarizer's best `n` sentences, as indexes into researchSentences(text).
const best = ({ topic, text }: SourceText, n: number) => {
  const all = researchSentences(text)
  const used = new Set<number>()
  for (const s of researchSentences(text, n, topic)) {
    const i = all.findIndex((t, j) => t === s && !used.has(j))
    if (i >= 0) used.add(i)
  }
  return [...used].sort((a, b) => a - b)
}
// Baseline: the sentence the research workflow's summarizer ranks first.
const baseline = (input: SourceText) => {
  const top = researchSentences(input.text, 1, input.topic)[0] ?? ''
  return [Math.max(0, researchSentences(input.text).indexOf(top))]
}
const PURPOSE = purpose(
  'These sentences come from one web page fetched for a research topic.',
  'Keep only the sentences that tell the reader something real about the topic.',
  'Word-count summaries keep menu, sign-up, and byline lines that tell the reader nothing.',
  'A sentence counts only when it states a fact itself; naming the topic is not enough.',
)
const payload = (input: SourceText) => {
  const all = researchSentences(input.text)
  const keep = best(input, MAX_SENTENCES)
  return {
    state: {
      purpose: PURPOSE,
      facts: {
        topic: { text: input.topic.slice(0, MAX_TOPIC) },
        candidates: Object.fromEntries(
          keep.map((i) => [`c${i}`, (all[i] ?? '').slice(0, MAX_SENTENCE)]),
        ),
      },
    },
    questions: {
      ...Object.fromEntries(
        keep.map((i) => [
          `c${i}`,
          noul(
            `Does \`facts.candidates.c${i}\` state a fact that helps answer \`facts.topic.text\`?`,
          ),
        ]),
      ),
      any: noul(
        'Does at least one entry of `facts.candidates` state a fact that helps answer `facts.topic.text`?',
      ),
    },
  }
}

export const researchSentence = defineDecision<SourceText, ReadonlyArray<number>>({
  name: 'research.sentences',
  sample: () => ({
    topic: 'SQLite in Bun',
    text: 'Bun is fast. Bun Bun Bun is loved by Bun fans. Bun ships a SQLite driver called bun:sqlite.',
  }),
  subtasks: [
    { name: 'states', primitive: 'noul', pattern: 'fan-out', payload: { question: 'any' } },
  ],
  payload,
  // Sure yes on `any` and on at least one candidate, else the fallback decides.
  read: (a, t, input) => {
    if (sureYes(a['any'], t) !== true) return undefined
    const yes = best(input, MAX_SENTENCES).filter((i) => sureYes(a[`c${i}`], t) === true)
    return yes.length === 0 ? undefined : yes
  },
  bar: CONFIDENCE_BAR,
  fallback: baseline,
  // Every pick names one of the sentences Jev saw.
  codeCheck: (picked, input) => picked.every((i) => best(input, MAX_SENTENCES).includes(i)),
  evals: 'tests/jev/evals/research.sentences.json',
  docs: DOCS,
})
