// SUMMARIZE command entry — invoked by `mise run run:summarize`. Parses flags,
// runs the Mastra summarize workflow, emits the result. No mise logic here.

import { Effect } from 'effect'
import { EXIT } from '../cli/exit-codes.ts'
import { runWorkflow } from '../cli/run.ts'
import { emitOpts, intFlag, parseFlags, timeoutFlag } from '../core/args.ts'
import { CliError, runMain } from '../core/effect.ts'

const main = Effect.gen(function* () {
  const { values, positionals } = yield* parseFlags(Bun.argv.slice(2), {
    text: { type: 'string' },
    url: { type: 'string' },
    sentences: { type: 'string' },
  })
  const text = values['text'] as string | undefined
  const url = (values['url'] as string | undefined) ?? positionals[0]
  if (!text && !url) {
    return yield* new CliError({
      message: 'summarize: missing input. Pass --text <text> or --url <url>.',
      exitCode: EXIT.usage,
    })
  }
  const inputData = {
    text,
    url,
    sentences: yield* intFlag('summarize', values, 'sentences', { def: 3, min: 1, max: 25 }),
    timeoutMs: yield* timeoutFlag('summarize', values),
  }
  return yield* runWorkflow(
    'summarize',
    () => import('../workflows/summarize.ts'),
    (m) => m.summarizeWorkflow,
    inputData,
    emitOpts(values),
  )
})

runMain(main)
