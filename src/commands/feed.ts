// FEED command entry — invoked by `mise run run:feed`. Parses flags, runs the
// Mastra feed workflow, emits the result. No mise logic here.
import { runWorkflow } from '../cli/run.ts'
import { emitOpts, intFlag, parseFlags, timeoutFlag } from '../core/args.ts'
import { logErr } from '../core/output.ts'
import { feedWorkflow } from '../workflows/feed.ts'

async function main(): Promise<number> {
  const { values, positionals } = parseFlags(Bun.argv.slice(2), {
    url: { type: 'string' },
    limit: { type: 'string' },
  })
  const url = (values.url as string) ?? positionals[0]
  if (!url) {
    logErr('feed: missing <url> (pass --url <feed-url> or a positional)')
    return 2
  }
  const inputData = {
    url,
    limit: intFlag('feed', values, 'limit', { def: 20, min: 1, max: 500 }),
    timeoutMs: timeoutFlag('feed', values),
  }
  return runWorkflow('feed', feedWorkflow, inputData, emitOpts(values))
}

process.exit(await main())
