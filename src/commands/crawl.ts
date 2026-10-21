// CRAWL command entry — invoked by `mise run run:crawl`. Parses flags,
// runs the Mastra crawl workflow, emits the result. No mise logic here.
import { Effect } from 'effect'
import { discoveryExit, runWorkflow } from '../cli/run.ts'
import { emitOpts, intFlag, optIntFlag, parseFlags, timeoutFlag } from '../core/args.ts'
import { CliError, runMain } from '../core/effect.ts'

const main = Effect.gen(function* () {
  const { values, positionals } = yield* parseFlags(Bun.argv.slice(2), {
    url: { type: 'string' },
    limit: { type: 'string' },
    depth: { type: 'string' },
    concurrency: { type: 'string' },
  })
  const url = (values['url'] as string) ?? positionals[0]
  if (!url) {
    return yield* new CliError({ message: 'crawl: missing --url <url>', exitCode: 2 })
  }
  const inputData = {
    url,
    limit: yield* intFlag('crawl', values, 'limit', { def: 5, min: 1, max: 1000 }),
    depth: yield* intFlag('crawl', values, 'depth', { def: 2, min: 0, max: 10 }),
    concurrency: yield* optIntFlag('crawl', values, 'concurrency', { min: 1, max: 32 }),
    timeoutMs: yield* timeoutFlag('crawl', values),
  }
  return yield* runWorkflow(
    'crawl',
    () => import('../workflows/crawl.ts'),
    (m) => m.crawlWorkflow,
    inputData,
    {
      ...emitOpts(values),
      exitCode: discoveryExit('pages'),
    },
  )
})

runMain(main)
