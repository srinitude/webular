// MAP command entry — invoked by `mise run run:map`. Parses flags,
// runs the Mastra map workflow, emits the result. No mise logic here.
import { parseFlags } from '../core/args.ts'
import { emit, logErr } from '../core/output.ts'
import { mapWorkflow } from '../workflows/map.ts'

interface WorkflowOutcome {
  status: string
  result?: unknown
  error?: unknown
}

async function main(): Promise<number> {
  const { values, positionals } = parseFlags(Bun.argv.slice(2), {
    url: { type: 'string' },
    limit: { type: 'string' },
  })
  const url = (values.url as string) ?? positionals[0]
  if (!url) {
    logErr('map: missing <url> (pass --url <url> or a positional URL)')
    return 2
  }
  const limit = values.limit ? parseInt(values.limit as string, 10) : undefined
  const inputData = limit !== undefined ? { url, limit } : { url }
  const run = await mapWorkflow.createRun({ runId: crypto.randomUUID() })
  const outcome = (await run.start({ inputData })) as WorkflowOutcome
  if (outcome.status !== 'success') {
    logErr(`map: failed (${String(outcome.error ?? outcome.status)})`)
    return 1
  }
  await emit(outcome.result, {
    json: Boolean(values.json),
    output: values.output as string | undefined,
  })
  return 0
}

process.exit(await main())
