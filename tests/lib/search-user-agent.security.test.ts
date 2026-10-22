// The DuckDuckGo HTML search names the tool honestly: the webular User-Agent,
// never a browser one (src/lib/AGENTS.md).
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { webSearch } from '../../src/lib/search.ts'
import { run, serving } from './sources/support.ts'

test(
  'web search sends the webular User-Agent',
  () =>
    run(
      Effect.map(serving('/html/', '<html><body></body></html>', webSearch('q', 3)), ({ seen }) => {
        expect(seen.agent).toStartWith('webular/')
      }),
    ),
  15_000,
)
