// Report claim guards (spec-integrity-and-report.md guard tests 22 and 23;
// audit finding 5): every comparison shows its statistics, and report text
// claims a win or loss only where the verdict holds.
import { Effect } from 'effect'
import type { Comparison, Verdict } from './schema.ts'

// Guard test 22: n, paired difference, 95% CI, test name, and Holm p.
export const checkStatsPresent = (c: Partial<Comparison>): Effect.Effect<void, Error> => {
  const ok =
    Number.isFinite(c.n) &&
    Number.isFinite(c.diff) &&
    c.ci?.length === 2 &&
    c.ci.every((x) => Number.isFinite(x)) &&
    c.test !== undefined &&
    Number.isFinite(c.pHolm)
  return ok
    ? Effect.void
    : Effect.fail(new Error(`comparison ${c.family}/${c.peer} is missing n, CI, test, or pHolm`))
}

const OVERCLAIM = /slightly (better|worse)|dimension winner/i

const claimOf = (line: string): Verdict | undefined => {
  if (/\bwins?\b|\bwon\b/i.test(line)) return 'win'
  return /\bloss(es)?\b|\blos(e|es|t)\b/i.test(line) ? 'loss' : undefined
}

// Guard test 23: a line naming a family and peer may say "win" or "loss"
// only when that comparison's verdict says so; overclaiming words never pass.
export const checkClaims = (
  text: string,
  comparisons: readonly Comparison[],
): Effect.Effect<void, Error> => {
  const banned = text.match(OVERCLAIM)
  if (banned !== null) return Effect.fail(new Error(`report says "${banned[0]}"`))
  const lines = text.split('\n')
  const wrong = comparisons.find((c) =>
    lines.some((l) => {
      const claim = l.includes(c.family) && l.includes(c.peer) ? claimOf(l) : undefined
      return claim !== undefined && claim !== c.verdict
    }),
  )
  return wrong === undefined
    ? Effect.void
    : Effect.fail(new Error(`report overclaims ${wrong.family}/${wrong.peer}: ${wrong.verdict}`))
}
