// DOCTOR command entry — invoked by `mise run run:doctor`. Runs diagnostics,
// emits { ok, checks }. No required flags.
import { parseFlags } from '../core/args.ts'
import { emit, logErr } from '../core/output.ts'
import { doctorWorkflow } from '../workflows/doctor.ts'

interface WorkflowOutcome {
  status: string
  result?: unknown
  error?: unknown
}

async function main(): Promise<number> {
  const { values } = parseFlags(Bun.argv.slice(2), {})
  const run = await doctorWorkflow.createRun({ runId: crypto.randomUUID() })
  const outcome = (await run.start({ inputData: {} })) as WorkflowOutcome
  if (outcome.status !== 'success') {
    logErr(`doctor: failed (${String(outcome.error ?? outcome.status)})`)
    return 1
  }
  await emit(outcome.result, {
    json: Boolean(values.json),
    output: values.output as string | undefined,
  })
  return 0
}

process.exit(await main())
