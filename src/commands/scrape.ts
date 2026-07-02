// SCRAPE command entry — invoked by `mise run run:scrape`. Parses flags,
// runs the Mastra scrape workflow, emits the result. No mise logic here.
import { runWorkflow } from '../cli/run.ts'
import { emitOpts, parseFlags, timeoutFlag } from '../core/args.ts'
import { logErr } from '../core/output.ts'
import { scrapeWorkflow } from '../workflows/scrape.ts'

async function main(): Promise<number> {
  const { values, positionals } = parseFlags(Bun.argv.slice(2), { url: { type: 'string' } })
  const url = (values.url as string) ?? positionals[0]
  if (!url) {
    logErr('scrape: missing --url <url>')
    return 2
  }
  const inputData = {
    url,
    timeoutMs: timeoutFlag('scrape', values),
  }
  return runWorkflow('scrape', scrapeWorkflow, inputData, emitOpts(values))
}

process.exit(await main())
