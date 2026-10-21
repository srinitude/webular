// FEED command entry — invoked by `mise run run:feed`. Parses flags, runs the
// Mastra feed workflow, emits the result. No mise logic here.
import { Effect } from 'effect'
import { runWorkflow } from '../cli/run.ts'
import { emitOpts, intFlag, parseFlags, timeoutFlag } from '../core/args.ts'
import { CliError, runMain } from '../core/effect.ts'

const main = Effect.gen(function* () {
  const { values, positionals } = yield* parseFlags(Bun.argv.slice(2), {
    url: { type: 'string' },
    limit: { type: 'string' },
    archive: { type: 'boolean' },
  })
  const url = (values['url'] as string) ?? positionals[0]
  if (!url) {
    return yield* new CliError({
      message: 'feed: missing <url>. Pass --url <feed-url> or put the URL after the command.',
      exitCode: 2,
    })
  }
  const inputData = {
    url,
    limit: yield* intFlag('feed', values, 'limit', { def: 20, min: 1, max: 500 }),
    timeoutMs: yield* timeoutFlag('feed', values),
    archive: values['archive'] === true,
  }
  return yield* runWorkflow(
    'feed',
    () => import('../workflows/feed.ts'),
    (m) => m.feedWorkflow,
    inputData,
    emitOpts(values),
  )
})

runMain(main)
