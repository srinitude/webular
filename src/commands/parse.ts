// PARSE command entry — invoked by `mise run run:parse`. Parses flags,
// runs the Mastra parse workflow, emits the result. No mise logic here.

import { Effect } from 'effect'
import { EXIT } from '../cli/exit-codes.ts'
import { runWorkflow } from '../cli/run.ts'
import { emitOpts, parseFlags } from '../core/args.ts'
import { CliError, runMain } from '../core/effect.ts'

const main = Effect.gen(function* () {
  const { values, positionals } = yield* parseFlags(Bun.argv.slice(2), { file: { type: 'string' } })
  const file = (values['file'] as string) ?? positionals[0]
  if (!file) {
    return yield* new CliError({
      message: 'parse: missing --file <path>. You can also put the path after the command.',
      exitCode: EXIT.usage,
    })
  }
  return yield* runWorkflow(
    'parse',
    () => import('../workflows/parse.ts'),
    (m) => m.parseWorkflow,
    { file },
    emitOpts(values),
  )
})

runMain(main)
