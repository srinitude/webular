// CRAWL command entry — invoked by `mise run run:crawl`. Parses flags,
// runs the Mastra crawl workflow, emits the result. No mise logic here.
import { discoveryExit, runWorkflow } from '../cli/run.ts'
import { emitOpts, intFlag, parseFlags, timeoutFlag } from '../core/args.ts'
import { logErr } from '../core/output.ts'
import { crawlWorkflow } from '../workflows/crawl.ts'

async function main(): Promise<number> {
  const { values, positionals } = parseFlags(Bun.argv.slice(2), {
    url: { type: 'string' },
    limit: { type: 'string' },
    depth: { type: 'string' },
    concurrency: { type: 'string' },
  })
  const url = (values.url as string) ?? positionals[0]
  if (!url) {
    logErr('crawl: missing --url <url>')
    return 2
  }
  const inputData = {
    url,
    limit: intFlag('crawl', values, 'limit', { def: 5, min: 1, max: 1000 }),
    depth: intFlag('crawl', values, 'depth', { def: 2, min: 0, max: 10 }),
    concurrency: intFlag('crawl', values, 'concurrency', { def: 4, min: 1, max: 32 }),
    timeoutMs: timeoutFlag('crawl', values),
  }
  return runWorkflow('crawl', crawlWorkflow, inputData, {
    ...emitOpts(values),
    exitCode: discoveryExit('pages'),
  })
}

process.exit(await main())
