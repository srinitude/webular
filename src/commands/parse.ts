// PARSE command entry — invoked by `mise run run:parse`. Parses flags,
// runs the Mastra parse workflow, emits the result. No mise logic here.
import { parseFlags } from '../core/args.ts'
import { emit, logErr } from '../core/output.ts'
import { parseWorkflow } from '../workflows/parse.ts'

interface WorkflowOutcome {
  status: string
  result?: unknown
  error?: unknown
}

async function main(): Promise<number> {
  const { values, positionals } = parseFlags(Bun.argv.slice(2), { file: { type: 'string' } })
  const file = (values.file as string) ?? positionals[0]
  if (!file) {
    logErr('parse: missing --file <path> (or pass a positional path)')
    return 2
  }
  const run = await parseWorkflow.createRun({ runId: crypto.randomUUID() })
  const outcome = (await run.start({ inputData: { file } })) as WorkflowOutcome
  if (outcome.status !== 'success') {
    logErr(`parse: failed (${String(outcome.error ?? outcome.status)})`)
    return 1
  }
  await emit(outcome.result, {
    json: Boolean(values.json),
    output: values.output as string | undefined,
  })
  return 0
}

process.exit(await main())
