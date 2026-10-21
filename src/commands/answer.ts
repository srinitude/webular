// ANSWER command entry — invoked by `mise run run:answer`. Parses flags,
// runs the Mastra answer workflow, emits the result. No mise logic here.
import { Effect } from 'effect'
import { discoveryExit, runWorkflow } from '../cli/run.ts'
import { emitOpts, intFlag, parseFlags, timeoutFlag } from '../core/args.ts'
import { CliError, runMain } from '../core/effect.ts'

const main = Effect.gen(function* () {
  const { values, positionals } = yield* parseFlags(Bun.argv.slice(2), {
    query: { type: 'string' },
    sources: { type: 'string' },
    sentences: { type: 'string' },
  })
  const query = (values['query'] as string) ?? positionals[0]
  if (!query) {
    return yield* new CliError({
      message: 'answer: missing --query <q> (or a positional query string)',
      exitCode: 2,
    })
  }
  const inputData = {
    query,
    sources: yield* intFlag('answer', values, 'sources', { def: 3, min: 1, max: 10 }),
    sentences: yield* intFlag('answer', values, 'sentences', { def: 3, min: 1, max: 25 }),
    timeoutMs: yield* timeoutFlag('answer', values),
  }
  return yield* runWorkflow(
    'answer',
    () => import('../workflows/answer.ts'),
    (m) => m.answerWorkflow,
    inputData,
    {
      ...emitOpts(values),
      exitCode: discoveryExit('answer'),
    },
  )
})

runMain(main)
