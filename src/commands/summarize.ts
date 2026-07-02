// SUMMARIZE command entry — invoked by `mise run run:summarize`. Parses flags,
// runs the Mastra summarize workflow, emits the result. No mise logic here.
import { runWorkflow } from '../cli/run.ts'
import { emitOpts, intFlag, parseFlags, timeoutFlag } from '../core/args.ts'
import { logErr } from '../core/output.ts'
import { summarizeWorkflow } from '../workflows/summarize.ts'

async function main(): Promise<number> {
  const { values, positionals } = parseFlags(Bun.argv.slice(2), {
    text: { type: 'string' },
    url: { type: 'string' },
    sentences: { type: 'string' },
  })
  const text = values.text as string | undefined
  const url = (values.url as string | undefined) ?? positionals[0]
  if (!text && !url) {
    logErr('summarize: missing input (pass --text <text> or --url <url>)')
    return 2
  }
  const inputData = {
    text,
    url,
    sentences: intFlag('summarize', values, 'sentences', { def: 3, min: 1, max: 25 }),
    timeoutMs: timeoutFlag('summarize', values),
  }
  return runWorkflow('summarize', summarizeWorkflow, inputData, emitOpts(values))
}

process.exit(await main())
