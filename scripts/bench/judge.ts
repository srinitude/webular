// LLM judges (spec-grading-and-stats.md, Judge rules; audit finding 12).
// Off by default: deterministic checks are the headline, and no judged score
// is used until the judge passes calibration (guard test 20). Judge inputs
// are blinded: no tool names, seeded answer order, capped length (test 21).
import { Effect } from 'effect'
import type { JudgeLabel } from './schema.ts'

export interface ReferenceInput {
  readonly answer: string
  readonly gold: string
  readonly aliases: readonly string[]
}

export interface ReferenceJudge {
  readonly model: string
  readonly judge: (input: ReferenceInput) => Effect.Effect<JudgeLabel, Error>
}

export interface RubricInput {
  readonly report: string
  readonly rubric: string
}

export interface RubricJudge {
  readonly model: string
  readonly score: (input: RubricInput) => Effect.Effect<number, Error>
}

// The default: no judge. Callers grade with deterministic checks only.
export const defaultJudge: ReferenceJudge | undefined = undefined

export const MIN_KAPPA = 0.8
export const MIN_ACCURACY = 0.95
export const MIN_CALIBRATION_ITEMS = 200

export interface Calibration {
  readonly n: number
  readonly kappa: number
  readonly accuracy: number
}

// Paired item count and the share of pairs where judge and human agree.
const agreement = (judged: readonly JudgeLabel[], human: readonly JudgeLabel[]) => {
  const n = Math.min(judged.length, human.length)
  return { n, rate: n === 0 ? 0 : judged.filter((l, i) => l === human[i]).length / n }
}

export const cohensKappa = (
  judged: readonly JudgeLabel[],
  human: readonly JudgeLabel[],
): number => {
  const { n, rate: agree } = agreement(judged, human)
  if (n === 0) return 0
  const labels = [...new Set([...judged, ...human])]
  const share = (xs: readonly JudgeLabel[], l: JudgeLabel) => xs.filter((x) => x === l).length / n
  const chance = labels.reduce((s, l) => s + share(judged, l) * share(human, l), 0)
  return chance === 1 ? 1 : (agree - chance) / (1 - chance)
}

export const calibrate = (
  judged: readonly JudgeLabel[],
  human: readonly JudgeLabel[],
): Calibration => {
  const { n, rate: accuracy } = agreement(judged, human)
  return { n, kappa: cohensKappa(judged, human), accuracy }
}

// Guard test 20: a judge is usable only after it passes calibration.
export const useJudge = <J extends { readonly model: string }>(
  judge: J,
  cal: Calibration,
): Effect.Effect<J, Error> =>
  cal.n >= MIN_CALIBRATION_ITEMS && cal.kappa >= MIN_KAPPA && cal.accuracy >= MIN_ACCURACY
    ? Effect.succeed(judge)
    : Effect.fail(
        new Error(
          `judge ${judge.model} not calibrated: n ${cal.n}, kappa ${cal.kappa}, accuracy ${cal.accuracy}`,
        ),
      )

export interface Answer {
  readonly tool: string
  readonly text: string
}

export interface JudgeInput {
  readonly texts: readonly string[]
  readonly order: readonly number[]
  readonly seed: number
  readonly cap: number
}

// Seeded rotation of answer positions: order[i] is the answer shown at i.
export const judgeOrder = (n: number, seed: number): number[] =>
  Array.from({ length: n }, (_, i) => (i + seed) % Math.max(1, n))

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const stripToolNames = (text: string, tools: readonly string[]): string =>
  tools
    .filter((t) => t !== '')
    .reduce((s, t) => s.replace(new RegExp(escapeRegex(t), 'gi'), '[tool]'), text)

export const buildJudgeInput = (
  answers: readonly Answer[],
  tools: readonly string[],
  seed: number,
  cap: number,
): JudgeInput => {
  const order = judgeOrder(answers.length, seed)
  const texts = order.map((i) => stripToolNames(answers[i]?.text ?? '', tools).slice(0, cap))
  return { texts, order, seed, cap }
}

// Guard test 21: no tool name, seeded order, and every text within the cap.
export const checkJudgeInput = (
  input: JudgeInput,
  tools: readonly string[],
): Effect.Effect<void, Error> => {
  const lower = input.texts.map((t) => t.toLowerCase())
  const named = tools.find((t) => t !== '' && lower.some((x) => x.includes(t.toLowerCase())))
  if (named !== undefined) return Effect.fail(new Error(`judge input names tool ${named}`))
  const expected = judgeOrder(input.texts.length, input.seed)
  if (input.order.some((o, i) => o !== expected[i]))
    return Effect.fail(new Error('judge input order not swapped by seed'))
  return input.texts.some((t) => t.length > input.cap)
    ? Effect.fail(new Error(`judge input over cap ${input.cap}`))
    : Effect.void
}
