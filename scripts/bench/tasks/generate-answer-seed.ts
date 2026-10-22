// Hand-curated answer tasks from answer-seed.json. Each gold answer comes from a
// page fetched on the build date; the span is the quote that proves it.
// kind "no-answer": the page says the fact is unknown. kind "ambiguous": the page lists several answers.
import seed from './answer-seed.json'
import { AUTHOR, BUILD_DATE, CANARY, type Task } from './generate-common.ts'

interface Seed {
  readonly kind: 'no-answer' | 'ambiguous'
  readonly id: string
  readonly domain: string
  readonly question: string
  readonly url: string
  readonly license: string
  readonly answers: ReadonlyArray<string>
  readonly spans: ReadonlyArray<string>
  readonly aliases: ReadonlyArray<string>
}

const toTask = (s: Seed): Task => {
  const noAnswer = s.kind === 'no-answer'
  const type = noAnswer ? 'answer.no-answer' : 'answer.short'
  return {
    id: `${type}.seed.${s.id}`,
    family: 'answer',
    author: AUTHOR,
    buildDate: BUILD_DATE,
    canary: CANARY,
    questionType: type,
    source: { url: s.url, asOf: BUILD_DATE, license: s.license },
    tags: {
      domain: s.domain,
      language: 'en',
      fresh: false,
      longTail: true,
      ambiguous: !noAnswer,
      premise: noAnswer ? 'no-answer' : 'none',
    },
    input: noAnswer ? { question: s.question } : { question: s.question, requireCitation: false },
    gold: noAnswer
      ? { answers: [], noAnswer: true, evidence: s.spans.map((span) => ({ url: s.url, span })) }
      : {
          answers: s.answers,
          acceptAny: true,
          evidence: s.spans.map((span) => ({ url: s.url, span })),
        },
    aliases: noAnswer ? [...s.aliases] : [...s.answers, ...s.aliases],
  }
}

export const seedTasks = (): Array<Task> => (seed as ReadonlyArray<Seed>).map(toTask)
