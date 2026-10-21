// DOCTOR command entry — invoked by `mise run run:doctor`. Runs diagnostics,
// emits { ok, checks }. No required flags.
import { Effect } from 'effect'
import { runWorkflow } from '../cli/run.ts'
import { emitOpts, parseFlags } from '../core/args.ts'
import { runMain } from '../core/effect.ts'

const main = Effect.gen(function* () {
  const { values } = yield* parseFlags(Bun.argv.slice(2), {})
  return yield* runWorkflow(
    'doctor',
    () => import('../workflows/doctor.ts'),
    (m) => m.doctorWorkflow,
    {},
    emitOpts(values),
  )
})

runMain(main)
