// research: done, or keep searching? The research workflow's search rounds ask it.
import { Effect } from 'effect'
import { JEV_CONCURRENCY, Jev, jevRuntime } from '../client.ts'
import { decide, defineDecision } from '../define.ts'
import { agreed, bothOrders, type Options, SUBTASKS } from '../fetch-page.ts'
import { batches, CAPS, CONFIDENCE_BAR, NONE_OPTION, purpose } from '../payload/index.ts'
import { bridgeEntity, keywordQuery } from './research-hop.ts'

export { bridgeEntity, keywordQuery }

interface ResearchState {
  readonly topic: string
  readonly subQuestions: ReadonlyArray<{ readonly question: string; readonly bestEvidence: string }>
  readonly round: number
  readonly maxRounds: number
}
type ResearchPart = { readonly s: ResearchState; readonly part: ResearchState['subQuestions'] }
const researchBaseline = (s: ResearchState): boolean => s.round >= s.maxRounds
// Rounds are counted in code (researchBaseline), never put in the payload.
const RESEARCH_PURPOSE = purpose(
  'We research a topic for a written report and must decide whether to stop searching.',
  'Stop only when every sub-question has evidence that states its answer.',
  'Stopping early leaves a gap in the report; searching on wastes time.',
  'Evidence that only describes the topic, without the specific answer, does not count.',
)
const RESEARCH_OPTIONS: Options = [
  [
    'keep_searching',
    {
      what: 'At least one sub-question has evidence that does not name its answer.',
      not_for: 'Evidence that names the answer, even in a few words.',
      examples: [
        'question "Does Redis support streams?", evidence "Redis is an in-memory data store."',
      ],
    },
  ],
  [
    'done',
    {
      what: 'Every sub-question has evidence that names its answer.',
      not_for: 'Evidence that only says what the topic is, with no answer to the question.',
      examples: [
        'question "Which tool formats Go code?", evidence "Go ships gofmt, a code formatter."',
      ],
    },
  ],
  [NONE_OPTION, 'None of these fit the evidence.'],
]
const RESEARCH_KINDS = ['keep_searching', 'done'] as const
// Done needs evidence text on every sub-question.
const codeCheck = (done: boolean, { part }: ResearchPart) =>
  !done || part.every((q) => q.bestEvidence.trim() !== '')
// One request per batch of at most CAPS.fields sub-questions, so each payload
// stays inside its caps however many sub-questions there are. One Choice in
// both option orders (pick, pick_reversed): both must agree and each must clear
// the 0.95 bar, so the lower of the two confidences is the one that counts.
export const researchPart = defineDecision<ResearchPart, boolean>({
  name: 'research.done',
  payload: ({ s, part }) => ({
    state: {
      purpose: RESEARCH_PURPOSE,
      // Flat under facts: one level, like the base `research` block that scored best.
      facts: {
        topic: s.topic,
        sub_questions: part.slice(0, CAPS.fields).map((q) => ({
          question: q.question,
          best_evidence: q.bestEvidence.slice(0, 800),
        })),
      },
    },
    questions: bothOrders(
      'Does every `facts.sub_questions` entry have `best_evidence` that names the answer to its `question` about `facts.topic`? A short phrase that names the answer counts, even when the sentence also describes the topic.',
      RESEARCH_OPTIONS,
    ),
  }),
  sample: () => {
    const s = {
      topic: 'SQLite in Bun',
      round: 1,
      maxRounds: 3,
      subQuestions: [
        { question: 'Which module gives SQLite in Bun?', bestEvidence: 'Bun ships bun:sqlite.' },
      ],
    }
    return { s, part: s.subQuestions }
  },
  subtasks: SUBTASKS,
  read: (a, t) => {
    const k = agreed(a, t, RESEARCH_KINDS)
    return k === undefined ? undefined : k === 'done'
  },
  bar: CONFIDENCE_BAR,
  fallback: () => false,
  codeCheck,
  evals: 'tests/jev/evals/research.done.json',
  docs: 'b0b26ab933a61b5d43ccccae5fbd009f445bfdcfd2808cac9e410a84f0fd8ca4',
})
// `baseline` is the rule the eval compares Jev against.
export const researchDone = Object.assign(
  (s: ResearchState) =>
    decide(
      'research.done',
      () => researchBaseline(s),
      () =>
        researchBaseline(s)
          ? Effect.succeed(true)
          : Effect.forEach(
              batches(s.subQuestions, CAPS.fields),
              (part) => researchPart({ s, part }),
              { concurrency: JEV_CONCURRENCY },
            ).pipe(Effect.map((parts) => parts.every(Boolean))),
    ),
  { baseline: researchBaseline },
)

interface Hit {
  readonly title: string
  readonly url: string
  readonly description: string
}
const RESEARCH_ROUNDS = 2 // one extra search at most
// Without Jev, or on any error, the rounds stop after one search.
const roundDone = (s: ResearchState) =>
  Effect.tryPromise(() =>
    jevRuntime.runPromise(
      Effect.gen(function* () {
        const jev = yield* Jev
        return jev.available ? yield* researchDone(s) : true
      }),
    ),
  ).pipe(Effect.orElseSucceed(() => true))

const evidenceOf = (hits: ReadonlyArray<Hit>) =>
  hits.map((h) => `${h.title}: ${h.description}`).join('\n')
const mergeHits = <H extends Hit>(hits: ReadonlyArray<H>, more: ReadonlyArray<H>) => {
  const seen = new Set(hits.map((h) => h.url))
  return [...hits, ...more.filter((h) => !seen.has(h.url))]
}

// Search rounds: another round runs only when research.done says the hits
// miss the topic, or the topic is a question. That round searches the topic as keywords, then hops to the
// bridge entity the hits name (topic → person → fact). A failed later search
// keeps the earlier hits.
export const searchRounds = <H extends Hit, E, R>(
  topic: string,
  depth: number,
  search: (query: string, limit: number) => Effect.Effect<ReadonlyArray<H>, E, R>,
) =>
  Effect.gen(function* () {
    let hits: ReadonlyArray<H> = yield* search(topic, depth)
    const safe = (q: string, limit = depth) =>
      search(q, limit).pipe(Effect.orElseSucceed((): ReadonlyArray<H> => []))
    for (let round = 1; round < RESEARCH_ROUNDS; round++) {
      const subQuestions = [{ question: topic, bestEvidence: evidenceOf(hits) }]
      // A question always hops: research.done judged "Nobel Prize" pages as done
      // for a question whose answer sits one entity further.
      const question = /\?\s*$/.test(topic)
      if (
        !question &&
        (yield* roundDone({ topic, subQuestions, round, maxRounds: RESEARCH_ROUNDS }))
      )
        break
      // A wider search finds the bridge; only its top `depth` hits become sources.
      const wide = yield* safe(keywordQuery(topic), depth * 2)
      hits = mergeHits(hits, wide.slice(0, depth))
      const bridge = bridgeEntity(
        topic,
        [...hits, ...wide].map((h) => h.description),
      )
      if (bridge) hits = mergeHits(hits, yield* safe(bridge))
    }
    return hits
  })
