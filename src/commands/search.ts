// SEARCH command entry — invoked by `mise run run:search`. Parses flags,
// runs the Mastra search workflow, emits the result. No mise logic here.

import { Effect } from 'effect'
import { EXIT } from '../cli/exit-codes.ts'
import { discoveryExit, runWorkflow } from '../cli/run.ts'
import { emitOpts, intFlag, parseFlags, strFlag } from '../core/args.ts'
import { CliError, runMain } from '../core/effect.ts'
import { MAX_VARIANTS, SEARCH_SOURCES, type SearchSource } from '../lib/search-source-names.ts'

type Values = Record<string, string | boolean | string[] | undefined>

const variantsOf = (values: Values) =>
  Effect.gen(function* () {
    const variants = [values['variant'] ?? []]
      .flat()
      .filter((v): v is string => typeof v === 'string')
    if (variants.length > MAX_VARIANTS) {
      return yield* new CliError({
        message: `search: --variant takes at most ${MAX_VARIANTS} values`,
        exitCode: EXIT.usage,
      })
    }
    return variants
  })

function buildInput(values: Values, positionals: string[]) {
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
    const variants = yield* variantsOf(values)
    return {
      query,
      limit: yield* intFlag('search', values, 'limit', { def: 10, min: 1, max: 50 }),
      source,
      ...(variants.length && { variants }),
    }
  })
}

const main = Effect.gen(function* () {
  const { values, positionals } = yield* parseFlags(Bun.argv.slice(2), {
    query: { type: 'string', short: 'q' },
    limit: { type: 'string' },
    source: { type: 'string' },
    variant: { type: 'string', multiple: true },
  })
  const inputData = yield* buildInput(values, positionals)
  return yield* runWorkflow(
    'search',
    () => import('../workflows/search.ts'),
    (m) => m.searchWorkflow,
    inputData,
    { ...emitOpts(values), exitCode: discoveryExit('results') },
  )
})

runMain(main)
