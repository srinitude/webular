// AUDIT command entry — invoked by `mise run run:audit`. Reports deepsec
// availability and the scan plan (keyless). No mise logic here.
import { Effect } from 'effect'
import { runWorkflow } from '../cli/run.ts'
import { emitOpts, parseFlags } from '../core/args.ts'
import { runMain } from '../core/effect.ts'

const main = Effect.gen(function* () {
  const { values } = yield* parseFlags(Bun.argv.slice(2), {})
  return yield* runWorkflow(
    'audit',
    () => import('../workflows/audit.ts'),
    (m) => m.auditWorkflow,
    {},
    emitOpts(values),
  )
})

runMain(main)
