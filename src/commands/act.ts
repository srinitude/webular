// ACT command entry — invoked by `mise run run:act`. Parses flags, runs the
// Mastra act workflow (agent-browser), emits the result. No mise logic here.
import { Effect } from 'effect'
import { EXIT } from '../cli/exit-codes.ts'
import { runWorkflow } from '../cli/run.ts'
import { emitOpts, parseFlags } from '../core/args.ts'
import { CliError, runMain } from '../core/effect.ts'

const main = Effect.gen(function* () {
  const { values, positionals } = yield* parseFlags(Bun.argv.slice(2), {
    url: { type: 'string' },
    screenshot: { type: 'string' },
  })
  const url = (values['url'] as string) ?? positionals[0]
  if (!url) {
    return yield* new CliError({
      message: 'act: missing <url>. Pass --url <url> or put the URL after the command.',
      exitCode: EXIT.usage,
    })
  }
  const inputData = { url, screenshot: values['screenshot'] as string | undefined }
  return yield* runWorkflow(
    'act',
    () => import('../workflows/act.ts'),
    (m) => m.actWorkflow,
    inputData,
    emitOpts(values),
  )
})

runMain(main)
