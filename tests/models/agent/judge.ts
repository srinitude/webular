// The `judge` eval kind: the grader track's `judge` from
// tests/models/grader/judge.ts grades the reply with one Claude model.
import { Effect } from 'effect'
import { type Ctx, evaluate } from '../check.ts'
import { judge } from '../grader/judge.ts'
import type { Eval, Scenario } from '../scenarios.ts'

// ponytail: one fixed Claude grader per reply; the grader track's
// cross-check (Cohen and Fleiss kappa) decides which judge sets headlines.
const GRADER_MODEL = 'claude-sonnet-5-5'

export const grade = (s: Scenario, ev: Eval, text: string, ctx: Ctx) =>
  ev.kind === 'code'
    ? Effect.succeed(evaluate(ev, text, ctx))
    : judge(GRADER_MODEL, ev.rubric ?? s.outcome, s.prompt, text).pipe(
        Effect.map(({ verdict }) => (verdict === 'pass' ? [] : ['judge failed the reply'])),
        Effect.catch((e) => Effect.succeed([`judge error: ${String(e)}`])),
      )
