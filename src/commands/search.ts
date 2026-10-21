// SEARCH command entry — invoked by `mise run run:search`. Parses flags,
// runs the Mastra search workflow, emits the result. No mise logic here.

import { Effect } from 'effect'
import { EXIT } from '../cli/exit-codes.ts'
import { runWorkflow } from '../cli/run.ts'
import { emitOpts, intFlag, parseFlags, strFlag } from '../core/args.ts'
import { CliError, runMain } from '../core/effect.ts'
import { SEARCH_SOURCES, type SearchSource } from '../lib/search-source-names.ts'

function buildInput(values: Record<string, string | boolean | undefined>, positionals: string[]) {
  return Effect.gen(function* () {
    const query = (values['query'] as string) ?? positionals[0]
    if (!query) {
      return yield* new CliError({
        message: 'search: missing <query>. Pass --query <q> or put the query after the command.',
        exitCode: EXIT.usage,
      })
    }
    const source = (strFlag(values, 'source') ?? 'web') as SearchSource
    if (!SEARCH_SOURCES.includes(source)) {
      return yield* new CliError({
        message: `search: --source must be one of ${SEARCH_SOURCES.join(', ')}`,
        exitCode: EXIT.usage,
      })
    }
    return {
      query,
      limit: yield* intFlag('search', values, 'limit', { def: 10, min: 1, max: 50 }),
      source,
    }
  })
}

const main = Effect.gen(function* () {
  const { values, positionals } = yield* parseFlags(Bun.argv.slice(2), {
    query: { type: 'string', short: 'q' },
    limit: { type: 'string' },
    source: { type: 'string' },
  })
  const inputData = yield* buildInput(values, positionals)
  return yield* runWorkflow(
    'search',
    () => import('../workflows/search.ts'),
    (m) => m.searchWorkflow,
    inputData,
    emitOpts(values),
  )
})

runMain(main)
