// ANSWER command entry — invoked by `mise run run:answer`. Parses flags,
// runs the Mastra answer workflow, emits the result. No mise logic here.
import { parseFlags } from '../core/args.ts'
import { emit, logErr } from '../core/output.ts'
import { answerWorkflow } from '../workflows/answer.ts'

interface WorkflowOutcome {
  status: string
  result?: unknown
  error?: unknown
}

async function main(): Promise<number> {
  const { values, positionals } = parseFlags(Bun.argv.slice(2), {
    query: { type: 'string' },
    sources: { type: 'string', default: '3' },
    sentences: { type: 'string', default: '3' },
  })
  const query = (values.query as string) ?? positionals[0]
  if (!query) {
    logErr('answer: missing --query <q> (or a positional query string)')
    return 2
  }
  const sources = Math.max(1, parseInt(String(values.sources ?? '3'), 10) || 3)
  const sentences = Math.max(1, parseInt(String(values.sentences ?? '3'), 10) || 3)
  const run = await answerWorkflow.createRun({ runId: crypto.randomUUID() })
  const outcome = (await run.start({ inputData: { query, sources, sentences } })) as WorkflowOutcome
  if (outcome.status !== 'success') {
    logErr(`answer: failed (${String(outcome.error ?? outcome.status)})`)
    return 1
  }
  await emit(outcome.result, {
    json: Boolean(values.json),
    output: values.output as string | undefined,
  })
  return 0
}

process.exit(await main())
