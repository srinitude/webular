// ANSWER command entry — invoked by `mise run run:answer`. Parses flags,
// runs the Mastra answer workflow, emits the result. No mise logic here.

import { Effect } from 'effect'
import { EXIT } from '../cli/exit-codes.ts'
import { discoveryExit, runWorkflow } from '../cli/run.ts'
import { emitOpts, intFlag, listFlag, parseFlags, timeoutFlag } from '../core/args.ts'
import { CliError, runMain } from '../core/effect.ts'

type Values = Parameters<typeof emitOpts>[0]

const answerInput = (values: Values, query: string) =>
  Effect.gen(function* () {
    return {
      query,
      sources: yield* intFlag('answer', values, 'sources', { def: 3, min: 1, max: 10 }),
      sentences: yield* intFlag('answer', values, 'sentences', { def: 3, min: 1, max: 25 }),
      timeoutMs: yield* timeoutFlag('answer', values),
      urls: listFlag(values['urls']),
    }
  })

const main = Effect.gen(function* () {
  const { values, positionals } = yield* parseFlags(Bun.argv.slice(2), {
    query: { type: 'string' },
    sources: { type: 'string' },
    sentences: { type: 'string' },
    urls: { type: 'string', multiple: true },
  })
  const query = (values['query'] as string) ?? positionals[0]
  if (!query) {
    return yield* new CliError({
      message: 'answer: missing --query <q>. You can also put the question after the command.',
      exitCode: EXIT.usage,
    })
  }
  const inputData = yield* answerInput(values, query)
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
