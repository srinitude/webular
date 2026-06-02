// CRAWL command entry — invoked by `mise run run:crawl`. Parses flags,
// runs the Mastra crawl workflow, emits the result. No mise logic here.
import { runWorkflow } from '../cli/run.ts'
import { parseFlags } from '../core/args.ts'
import { logErr } from '../core/output.ts'
import { crawlWorkflow } from '../workflows/crawl.ts'

function intFlag(value: unknown, fallback: number, min: number): number {
  return Math.max(min, Number.parseInt(String(value ?? fallback), 10) || fallback)
}

async function main(): Promise<number> {
  const { values, positionals } = parseFlags(Bun.argv.slice(2), {
    url: { type: 'string' },
    limit: { type: 'string', default: '5' },
    depth: { type: 'string', default: '2' },
    concurrency: { type: 'string', default: '4' },
  })
  const url = (values.url as string) ?? positionals[0]
  if (!url) {
    logErr('crawl: missing --url <url>')
    return 2
  }
  const inputData = {
    url,
    limit: intFlag(values.limit, 5, 1),
    depth: intFlag(values.depth, 2, 0),
    concurrency: intFlag(values.concurrency, 4, 1),
  }
  const opts = { json: Boolean(values.json), output: values.output as string | undefined }
  return runWorkflow('crawl', crawlWorkflow, inputData, opts)
}

process.exit(await main())
