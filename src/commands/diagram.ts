// DIAGRAM command entry — invoked by `mise run run:diagram`. Parses flags,
// runs the Mastra diagram workflow, emits the result. No mise logic here.
import { parseFlags } from '../core/args.ts'
import { emit, logErr } from '../core/output.ts'
import { diagramRenderWorkflow, diagramWorkflow } from '../workflows/diagram.ts'

interface WorkflowOutcome {
  status: string
  result?: unknown
  error?: unknown
}

async function main(): Promise<number> {
  const { values } = parseFlags(Bun.argv.slice(2), {
    list: { type: 'boolean', default: false },
  })

  const doList = Boolean(values.list)
  const wf = doList ? diagramWorkflow : diagramRenderWorkflow

  const run = await wf.createRun({ runId: crypto.randomUUID() })
  const outcome = (await run.start({ inputData: { list: doList } })) as WorkflowOutcome

  if (outcome.status !== 'success') {
    logErr(`diagram: failed (${String(outcome.error ?? outcome.status)})`)
    return 1
  }

  await emit(outcome.result, {
    json: Boolean(values.json),
    output: values.output as string | undefined,
  })
  return 0
}

process.exit(await main())
