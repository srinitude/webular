// ANSWER command entry — invoked by `mise run run:answer`. Parses flags,
// runs the Mastra answer workflow, emits the result. No mise logic here.
import { discoveryExit, runWorkflow } from '../cli/run.ts'
import { emitOpts, intFlag, parseFlags, timeoutFlag } from '../core/args.ts'
import { logErr } from '../core/output.ts'
import { answerWorkflow } from '../workflows/answer.ts'

async function main(): Promise<number> {
  const { values, positionals } = parseFlags(Bun.argv.slice(2), {
    query: { type: 'string' },
    sources: { type: 'string' },
    sentences: { type: 'string' },
  })
  const query = (values.query as string) ?? positionals[0]
  if (!query) {
    logErr('answer: missing --query <q> (or a positional query string)')
    return 2
  }
  const inputData = {
    query,
    sources: intFlag('answer', values, 'sources', { def: 3, min: 1, max: 10 }),
    sentences: intFlag('answer', values, 'sentences', { def: 3, min: 1, max: 25 }),
    timeoutMs: timeoutFlag('answer', values),
  }
  return runWorkflow('answer', answerWorkflow, inputData, {
    ...emitOpts(values),
    exitCode: discoveryExit('answer'),
  })
}

process.exit(await main())
