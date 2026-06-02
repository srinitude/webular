// SCRAPE command entry — invoked by `mise run run:scrape`. Parses flags,
// runs the Mastra scrape workflow, emits the result. No mise logic here.
import { parseFlags } from '../core/args.ts'
import { emit, logErr } from '../core/output.ts'
import { scrapeWorkflow } from '../workflows/scrape.ts'

interface WorkflowOutcome {
  status: string
  result?: unknown
  error?: unknown
}

async function main(): Promise<number> {
  const { values, positionals } = parseFlags(Bun.argv.slice(2), { url: { type: 'string' } })
  const url = (values.url as string) ?? positionals[0]
  if (!url) {
    logErr('scrape: missing <url> (pass --url <url> or a positional URL)')
    return 2
  }
  const run = await scrapeWorkflow.createRun({ runId: crypto.randomUUID() })
  const outcome = (await run.start({ inputData: { url } })) as WorkflowOutcome
  if (outcome.status !== 'success') {
    logErr(`scrape: failed (${String(outcome.error ?? outcome.status)})`)
    return 1
  }
  await emit(outcome.result, {
    json: Boolean(values.json),
    output: values.output as string | undefined,
  })
  return 0
}

process.exit(await main())
