// DIAGRAM command entry — invoked by `mise run run:diagram`. Lists the XState
// machines that model the CLI flows (src/machines). No mise logic here.
import { Effect } from 'effect'
import { runWorkflow } from '../cli/run.ts'
import { emitOpts, parseFlags } from '../core/args.ts'
import { runMain } from '../core/effect.ts'

const main = Effect.gen(function* () {
  const { values } = yield* parseFlags(Bun.argv.slice(2))
  return yield* runWorkflow(
    'diagram',
    () => import('../workflows/diagram.ts'),
    (m) => m.diagramWorkflow,
    {},
    emitOpts(values),
  )
})

runMain(main)
