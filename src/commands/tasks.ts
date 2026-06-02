// TASKS command entry — invoked by `mise run run:tasks`. Parses flags,
// runs the Mastra tasks workflow, emits the result. No mise logic here.
import { parseFlags } from '../core/args.ts'
import { emit, logErr } from '../core/output.ts'
import { tasksWorkflow } from '../workflows/tasks.ts'

interface WorkflowOutcome {
  status: string
  result?: unknown
  error?: unknown
}

async function main(): Promise<number> {
  const { values } = parseFlags(Bun.argv.slice(2))
  const run = await tasksWorkflow.createRun({ runId: crypto.randomUUID() })
  const outcome = (await run.start({ inputData: { cwd: process.cwd() } })) as WorkflowOutcome
  if (outcome.status !== 'success') {
    logErr(`tasks: failed (${String(outcome.error ?? outcome.status)})`)
    return 1
  }
  await emit(outcome.result, {
    json: Boolean(values.json),
    output: values.output as string | undefined,
  })
  return 0
}

process.exit(await main())
