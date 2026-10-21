// MAP command entry — invoked by `mise run run:map`. Parses flags,
// runs the Mastra map workflow, emits the result. No mise logic here.

import { Effect } from 'effect'
import { EXIT } from '../cli/exit-codes.ts'
import { discoveryExit, runWorkflow } from '../cli/run.ts'
import { emitOpts, optIntFlag, parseFlags, timeoutFlag } from '../core/args.ts'
import { CliError, runMain } from '../core/effect.ts'

const main = Effect.gen(function* () {
  const { values, positionals } = yield* parseFlags(Bun.argv.slice(2), {
    url: { type: 'string' },
    limit: { type: 'string' },
  })
  const url = (values['url'] as string) ?? positionals[0]
  if (!url) {
    return yield* new CliError({
      message: 'map: missing <url>. Pass --url <url> or put the URL after the command.',
      exitCode: EXIT.usage,
    })
  }
  const inputData = {
    url,
    limit: yield* optIntFlag('map', values, 'limit', { min: 1, max: 10_000 }),
    timeoutMs: yield* timeoutFlag('map', values),
  }
  return yield* runWorkflow(
    'map',
    () => import('../workflows/map.ts'),
    (m) => m.mapWorkflow,
    inputData,
    {
      ...emitOpts(values),
      exitCode: discoveryExit('links'),
    },
  )
})

runMain(main)
