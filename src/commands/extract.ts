// EXTRACT command entry — invoked by `mise run run:extract`. Parses flags,
// runs the Mastra extract workflow, emits the result. No mise logic here.
import { Effect } from 'effect'
import { runWorkflow } from '../cli/run.ts'
import { emitOpts, parseFlags, timeoutFlag } from '../core/args.ts'
import { CliError, runMain } from '../core/effect.ts'

function buildInput(values: Record<string, string | boolean | undefined>, positionals: string[]) {
  return Effect.gen(function* () {
    const url = (values['url'] as string) ?? positionals[0]
    if (!url) {
      return yield* new CliError({
        message: 'extract: missing <url>. Pass --url <url> or put the URL after the command.',
        exitCode: 2,
      })
    }
    if (!values['fields'] && !values['selector']) {
      return yield* new CliError({
        message: 'extract: missing fields. Pass --fields "name:selector[,...]" or --selector <css>',
        exitCode: 2,
      })
    }
    return {
      url,
      fields: values['fields'] as string | undefined,
      selector: values['selector'] as string | undefined,
      timeoutMs: yield* timeoutFlag('extract', values),
    }
  })
}

const main = Effect.gen(function* () {
  const { values, positionals } = yield* parseFlags(Bun.argv.slice(2), {
    url: { type: 'string' },
    fields: { type: 'string' },
    selector: { type: 'string' },
  })
  const inputData = yield* buildInput(values, positionals)
  return yield* runWorkflow(
    'extract',
    () => import('../workflows/extract.ts'),
    (m) => m.extractWorkflow,
    inputData,
    emitOpts(values),
  )
})

runMain(main)
