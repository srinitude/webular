// Arm and task order for a round (bench/spec/spec-grading-and-stats.md, ABBA
// order; AGENTS.md, seeded random order). Tasks and peers are shuffled per
// run from one seed. Webular leads or trails all peers in an A,B,B,A cycle
// across runs, so every webular-versus-peer timed pair is counterbalanced;
// a seeded coin per task picks which arm opens the cycle.
import { Effect, Random } from 'effect'
import { BenchError } from './model.ts'

interface Step<T, P> {
  run: number
  task: T
  provider: P
}

// Runs 1 and 4 of each cycle of four put webular first; runs 2 and 3 put it last.
export const webularLeads = (run: number, flip: boolean) => run % 4 <= 1 !== flip

export const resolveSeed = (raw: string | undefined) => {
  if (raw === undefined) return Random.nextIntBetween(0, 2 ** 31 - 1)
  const n = Number(raw)
  return Number.isSafeInteger(n)
    ? Effect.succeed(n)
    : Effect.fail(new BenchError({ message: `--seed must be an integer, got ${raw}` }))
}

const armsFor = <P extends { id: string }>(providers: readonly P[], leads: boolean) =>
  Effect.map(Random.shuffle(providers.filter((p) => p.id !== 'webular')), (others) => {
    const web = providers.filter((p) => p.id === 'webular')
    return leads ? [...web, ...others] : [...others, ...web]
  })

export const schedule = <T extends { id: string }, P extends { id: string }>(
  seed: number,
  tasks: readonly T[],
  providers: readonly P[],
  runs: number,
) =>
  Effect.gen(function* () {
    const flips = new Map<string, boolean>()
    for (const t of tasks) flips.set(t.id, yield* Random.nextBoolean)
    const stepsFor = (run: number, task: T) =>
      Effect.map(armsFor(providers, webularLeads(run, flips.get(task.id) ?? false)), (arms) =>
        arms.map((provider): Step<T, P> => ({ run, task, provider })),
      )
    const steps: Step<T, P>[] = []
    for (let run = 1; run <= runs; run++) {
      const order = yield* Random.shuffle(tasks)
      for (const task of order) steps.push(...(yield* stepsFor(run, task)))
    }
    return steps
  }).pipe(Random.withSeed(seed))
