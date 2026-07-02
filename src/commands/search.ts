// SEARCH command entry — invoked by `mise run run:search`. Parses flags,
// runs the Mastra search workflow, emits the result. No mise logic here.
import { runWorkflow } from '../cli/run.ts'
import { emitOpts, intFlag, parseFlags } from '../core/args.ts'
import { logErr } from '../core/output.ts'
import { searchWorkflow } from '../workflows/search.ts'

async function main(): Promise<number> {
  const { values, positionals } = parseFlags(Bun.argv.slice(2), {
    query: { type: 'string', short: 'q' },
    limit: { type: 'string' },
  })
  const query = (values.query as string) ?? positionals[0]
  if (!query) {
    logErr('search: missing <query> (pass --query <q> or a positional)')
    return 2
  }
  const inputData = {
    query,
    limit: intFlag('search', values, 'limit', { def: 10, min: 1, max: 50 }),
  }
  return runWorkflow('search', searchWorkflow, inputData, emitOpts(values))
}

process.exit(await main())
