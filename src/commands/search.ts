// SEARCH command entry — invoked by `mise run run:search`. Parses flags,
// runs the Mastra search workflow, emits the result. No mise logic here.
import { runWorkflow } from '../cli/run.ts'
import { emitOpts, intFlag, parseFlags, strFlag } from '../core/args.ts'
import { logErr } from '../core/output.ts'
import { SEARCH_SOURCES, type SearchSource } from '../lib/sources-search.ts'
import { searchWorkflow } from '../workflows/search.ts'

async function main(): Promise<number> {
  const { values, positionals } = parseFlags(Bun.argv.slice(2), {
    query: { type: 'string', short: 'q' },
    limit: { type: 'string' },
    source: { type: 'string' },
  })
  const query = (values.query as string) ?? positionals[0]
  if (!query) {
    logErr('search: missing <query> (pass --query <q> or a positional)')
    return 2
  }
  const source = (strFlag(values, 'source') ?? 'web') as SearchSource
  if (!SEARCH_SOURCES.includes(source)) {
    logErr(`search: --source must be one of ${SEARCH_SOURCES.join(', ')}`)
    return 2
  }
  const inputData = {
    query,
    limit: intFlag('search', values, 'limit', { def: 10, min: 1, max: 50 }),
    source,
  }
  return runWorkflow('search', searchWorkflow, inputData, emitOpts(values))
}

process.exit(await main())
