// Labeled eval for the Cua grounder's two judgments: codeDecisions against
// jevDecisions (live Jev, falling back to code). Candidates come from
// candidatesFor, exactly as runGoal builds them. Run:
//   bun tests/engine/cua-jev.eval.ts
// The key comes from TYPESAFE_API_KEY or the Keychain; without one only
// codeDecisions is scored.
import { Config, Console, Effect, Option, Redacted } from 'effect'
import { runMain } from '../../src/core/effect.ts'
import { runProc } from '../../src/core/proc.ts'
import { candidatesFor, codeDecisions, type Decisions } from '../../src/lib/cua-ground.ts'
import { jevDecisions, postJev } from '../../src/lib/cua-jev.ts'
import type { AxElement } from '../../src/lib/cua-tree.ts'
import { cases } from './cua-jev-fixtures.ts'

const idOf = Option.match({ onNone: () => null, onSome: (e: AxElement) => e.id })

const score = (d: Decisions) =>
  Effect.forEach(
    cases,
    (c) => {
      const candidates = candidatesFor(c.intent, c.elements)
      return Effect.all({
        pick: Effect.map(d.pickTarget(c.intent, candidates), idOf),
        feasible: d.feasible(c.goal, c.intent, candidates),
      }).pipe(
        Effect.map((got) => ({
          c,
          got,
          pickOk: got.pick === c.pick,
          feasibleOk: got.feasible === c.feasible,
        })),
      )
    },
    { concurrency: 4 },
  )

const report = Effect.fnUntraced(function* (
  name: string,
  rows: Effect.Success<ReturnType<typeof score>>,
) {
  const n = rows.length
  const pickOk = rows.filter((r) => r.pickOk).length
  const feasibleOk = rows.filter((r) => r.feasibleOk).length
  yield* Console.log(`${name}: pickTarget ${pickOk}/${n}, feasible ${feasibleOk}/${n}`)
  for (const r of rows.filter((r) => !r.pickOk || !r.feasibleOk))
    yield* Console.log(
      `  miss ${r.c.name}: pick ${r.got.pick} (want ${r.c.pick}), feasible ${r.got.feasible} (want ${r.c.feasible})`,
    )
})

// Counts how often the code fallback answered instead of Jev.
const counting = () => {
  const fell = { pickTarget: 0, feasible: 0 }
  const fallback: Decisions = {
    pickTarget: (i, cs) =>
      Effect.suspend(() => {
        fell.pickTarget++
        return codeDecisions.pickTarget(i, cs)
      }),
    feasible: (g, i, cs) =>
      Effect.suspend(() => {
        fell.feasible++
        return codeDecisions.feasible(g, i, cs)
      }),
  }
  return { fell, fallback }
}

// TYPESAFE_API_KEY, else the macOS Keychain item, read inside this process so
// the key never passes through a shell.
const keychainKey = runProc(
  ['security', 'find-generic-password', '-s', 'typesafe-ai-api-key', '-w'],
  {
    timeoutMs: 5_000,
  },
).pipe(
  Effect.map((r) =>
    r.code === 0 && r.stdout.trim() ? Option.some(Redacted.make(r.stdout.trim())) : Option.none(),
  ),
  Effect.orElseSucceed(() => Option.none<Redacted.Redacted<string>>()),
)

const main = Effect.gen(function* () {
  yield* report('code', yield* score(codeDecisions))
  const fromEnv = yield* Config.option(Config.Redacted('TYPESAFE_API_KEY'))
  const key = Option.isSome(fromEnv) ? fromEnv : yield* keychainKey
  if (Option.isNone(key)) {
    yield* Console.log('jev: not run (no TYPESAFE_API_KEY and no Keychain item)')
    return 0
  }
  const { fell, fallback } = counting()
  yield* report('jev', yield* score(jevDecisions(postJev, fallback)))
  const n = cases.length
  yield* Console.log(
    `  jev answers used: pickTarget ${n - fell.pickTarget}/${n}, feasible ${n - fell.feasible}/${n} (rest fell back to code)`,
  )
  return 0
})

if (import.meta.main) runMain(main)
