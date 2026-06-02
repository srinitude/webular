// SEARCH command entry — invoked by `mise run run:search`. Parses flags,
// runs the Mastra search workflow, emits the result. No mise logic here.
import { parseFlags } from '../core/args.ts'
import { emit, logErr } from '../core/output.ts'
import { searchWorkflow } from '../workflows/search.ts'

interface WorkflowOutcome {
  status: string
  result?: unknown
  error?: unknown
}

async function main(): Promise<number> {
  const { values, positionals } = parseFlags(Bun.argv.slice(2), {
    query: { type: 'string', short: 'q' },
    limit: { type: 'string' },
  })
  const query = (values.query as string) ?? positionals[0]
  if (!query) {
    logErr('search: missing <query> (pass --query <q> or a positional)')
    return 2
  }
  const limit = values.limit ? parseInt(values.limit as string, 10) : 10
  const run = await searchWorkflow.createRun({ runId: crypto.randomUUID() })
  const outcome = (await run.start({ inputData: { query, limit } })) as WorkflowOutcome
  if (outcome.status !== 'success') {
    logErr(`search: failed (${String(outcome.error ?? outcome.status)})`)
    return 1
  }
  await emit(outcome.result, {
    json: Boolean(values.json),
    output: values.output as string | undefined,
  })
  return 0
}

process.exit(await main())
