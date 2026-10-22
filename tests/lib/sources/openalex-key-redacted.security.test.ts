// OPENALEX_API_KEY rides in the query string, so a failed call must not echo
// it in the error text that reaches stderr and MCP results.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { errMsg } from '../../../src/core/output.ts'
import { OpenAlexLimit, openalex } from '../../../src/lib/scholarly.ts'
import { against, json, run } from './support.ts'

test(
  'a failed OpenAlex call keeps the API key out of the error',
  () =>
    run(
      Effect.gen(function* () {
        const out = yield* against(
          { '/works': () => json('{}', 404) },
          openalex('crispr', 2).pipe(Effect.flip),
          { OPENALEX_API_KEY: 'sk-live-secret-42' },
        ).pipe(Effect.provideService(OpenAlexLimit, { until: 0 }))
        expect(errMsg(out)).toContain('404')
        expect(errMsg(out)).not.toContain('sk-live-secret-42')
      }),
    ),
  15_000,
)
