// AUDIT command entry — invoked by `mise run run:audit`. Parses flags,
// runs the Mastra audit workflow, emits the result. No mise logic here.
import { parseFlags } from '../core/args.ts'
import { emit, logErr } from '../core/output.ts'
import { auditWorkflow } from '../workflows/audit.ts'

interface WorkflowOutcome {
  status: string
  result?: unknown
  error?: unknown
}

async function main(): Promise<number> {
  const { values } = parseFlags(Bun.argv.slice(2), {
    plan: { type: 'boolean', default: false },
  })
  const plan = Boolean(values.plan)
  const run = await auditWorkflow.createRun({ runId: crypto.randomUUID() })
  const outcome = (await run.start({ inputData: { plan } })) as WorkflowOutcome
  if (outcome.status !== 'success') {
    logErr(`audit: failed (${String(outcome.error ?? outcome.status)})`)
    return 1
  }
  await emit(outcome.result, {
    json: Boolean(values.json),
    output: values.output as string | undefined,
  })
  return 0
}

process.exit(await main())
