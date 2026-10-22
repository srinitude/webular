// Length-normalized grading (spec-grading-and-stats.md, "Length earns nothing").
// Plain containment over the whole text rewards long outputs that list many
// candidates. Here `contains` and `regex` checks look only at the answer field.
// The spec sets no fixed character window, so there is no first-N rule: text
// with no answer field cannot pass a containment check. An answer job's output
// is the answer itself, so for that job bare text is the answer field, for
// every provider (the webular and Exa adapters return a bare answer string).
// A scrape job asks no question: its output is the page text, so its checks
// read that text whole, for every provider.
import { Effect, Option, Schema } from 'effect'
import { buildJudgeInput, type Calibration, type defaultJudge, useJudge } from '../judge.ts'
import type { Check, RecordedOutput, Task } from './model.ts'
import { checkPasses } from './score.ts'

type Out = Pick<RecordedOutput, 'text' | 'urls'>
type Judge = NonNullable<typeof defaultJudge>

const answerLine = /^\s*(?:final\s+)?answer\s*[:-]\s*(.+)$/imu
const decodeJson = Schema.decodeUnknownOption(
  Schema.fromJsonString(Schema.Struct({ answer: Schema.String })),
)

// The answer field: a JSON `answer` string, else an `Answer:` line.
export const answerField = (text: string): string | undefined =>
  Option.getOrUndefined(Option.map(decodeJson(text.trim()), (v) => v.answer)) ??
  answerLine.exec(text)?.[1]?.trim()

export function gradeCheck(check: Check, out: Out, bare = false): boolean {
  if (check.kind !== 'contains' && check.kind !== 'regex') return checkPasses(check, out)
  const answer = answerField(out.text) ?? (bare ? out.text.trim() : undefined)
  return answer !== undefined && checkPasses(check, { text: answer, urls: [] })
}

// An extract job's output is its JSON text, read whole like a page.
const bareJobs = new Set<Task['job']>(['answer', 'scrape', 'extract'])

export const answerAccuracy = (task: Task, out: Out): number =>
  task.checks.every((c) => gradeCheck(c, out, bareJobs.has(task.job))) ? 1 : 0

// Blinding: every tool and provider name becomes `[tool]`. The spec's cap is
// per task and no task sets one, so nothing is cut here.
export const blindForJudge = (text: string, names: readonly string[]): string =>
  buildJudgeInput([{ tool: '', text }], names, 0, Number.POSITIVE_INFINITY).texts[0] ?? ''

export interface JudgeSetup {
  readonly judge: Judge | undefined
  readonly calibration: Calibration | undefined
  readonly names: readonly string[]
}

// The judge's verdict counts only once it passes calibration (kappa >= 0.8,
// accuracy >= 95%, 200+ items, flip rate under 2%); otherwise the containment verdict stands.
export const judgedAccuracy = (setup: JudgeSetup, task: Task, out: Out): Effect.Effect<number> => {
  const fallback = answerAccuracy(task, out)
  const [gold, ...aliases] = task.answers ?? []
  if (!setup.judge || !setup.calibration || gold === undefined) return Effect.succeed(fallback)
  const answer = blindForJudge(out.text, setup.names)
  return useJudge(setup.judge, setup.calibration).pipe(
    Effect.flatMap((j) => j.judge({ answer, gold, aliases })),
    Effect.map((label) => (label === 'correct' ? 1 : 0)),
    Effect.orElseSucceed(() => fallback),
  )
}
