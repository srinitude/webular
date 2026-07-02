// PARSE command entry — invoked by `mise run run:parse`. Parses flags,
// runs the Mastra parse workflow, emits the result. No mise logic here.
import { runWorkflow } from '../cli/run.ts'
import { emitOpts, parseFlags } from '../core/args.ts'
import { logErr } from '../core/output.ts'
import { parseWorkflow } from '../workflows/parse.ts'

async function main(): Promise<number> {
  const { values, positionals } = parseFlags(Bun.argv.slice(2), { file: { type: 'string' } })
  const file = (values.file as string) ?? positionals[0]
  if (!file) {
    logErr('parse: missing --file <path> (or pass a positional path)')
    return 2
  }
  return runWorkflow('parse', parseWorkflow, { file }, emitOpts(values))
}

process.exit(await main())
