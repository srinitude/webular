// RESEARCH command entry — invoked by `mise run run:research`. Parses flags,
// runs the Mastra research workflow, emits the result. No mise logic here.
import { parseFlags } from '../core/args.ts'
import { emit, logErr } from '../core/output.ts'
import { researchWorkflow } from '../workflows/research.ts'

interface WorkflowOutcome {
  status: string
  result?: unknown
  error?: unknown
}

async function main(): Promise<number> {
  const { values, positionals } = parseFlags(Bun.argv.slice(2), {
    topic: { type: 'string', short: 't' },
    depth: { type: 'string' },
    sentences: { type: 'string' },
  })
  const topic = (values.topic as string) ?? positionals[0]
  if (!topic) {
    logErr('research: missing --topic <t> (or pass topic as a positional)')
    return 2
  }
  const depth = values.depth ? parseInt(values.depth as string, 10) : 3
  const sentences = values.sentences ? parseInt(values.sentences as string, 10) : 2
  const run = await researchWorkflow.createRun({ runId: crypto.randomUUID() })
  const outcome = (await run.start({ inputData: { topic, depth, sentences } })) as WorkflowOutcome
  if (outcome.status !== 'success') {
    logErr(`research: failed (${String(outcome.error ?? outcome.status)})`)
    return 1
  }
  await emit(outcome.result, {
    json: Boolean(values.json),
    output: values.output as string | undefined,
  })
  return 0
}

process.exit(await main())
