// SCRAPE command entry — invoked by `mise run run:scrape`. Parses flags,
// runs the Mastra scrape workflow, emits the result. No mise logic here.
import { Effect } from 'effect'
import { runWorkflow } from '../cli/run.ts'
import { emitOpts, parseFlags, timeoutFlag } from '../core/args.ts'
import { CliError, runMain } from '../core/effect.ts'

const main = Effect.gen(function* () {
  const { values, positionals } = yield* parseFlags(Bun.argv.slice(2), {
    url: { type: 'string' },
    archive: { type: 'boolean' },
  })
  const url = (values.url as string) ?? positionals[0]
  if (!url) {
    return yield* new CliError({ message: 'scrape: missing --url <url>', exitCode: 2 })
  }
  const inputData = {
    url,
    timeoutMs: yield* timeoutFlag('scrape', values),
    archive: values.archive === true,
  }
  return yield* runWorkflow(
    'scrape',
    () => import('../workflows/scrape.ts'),
    (m) => m.scrapeWorkflow,
    inputData,
    emitOpts(values),
  )
})

runMain(main)
