// TASKS command entry — invoked by `mise run run:tasks`. Parses flags,
// runs the Mastra tasks workflow, emits the result. No mise logic here.
import { Effect } from 'effect'
import { runWorkflow } from '../cli/run.ts'
import { emitOpts, parseFlags } from '../core/args.ts'
import { runMain } from '../core/effect.ts'

const main = Effect.gen(function* () {
  const { values } = yield* parseFlags(Bun.argv.slice(2))
  return yield* runWorkflow(
    'tasks',
    () => import('../workflows/tasks.ts'),
    (m) => m.tasksWorkflow,
    { cwd: process.cwd() },
    emitOpts(values),
  )
})

runMain(main)
