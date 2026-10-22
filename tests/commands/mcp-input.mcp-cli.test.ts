// `webular mcp` refuses bad tool input with an isError result instead of
// dropping it: a misspelled key or a bad paging cursor. Run by `mise run bugs:mcp-cli`.
import { expect, test } from 'bun:test'
import { Effect } from 'effect'
import { connected } from '../_support/mcp-client.ts'
import { eff } from '../_support/run.ts'

const bad: [string, Record<string, unknown>][] = [
  // A bad cursor must not silently restart or misread the paged result.
  ['tasks', { cursor: -5 }],
  ['tasks', { cursor: 'next' }],
  // An unknown or misspelled key fails the call instead of vanishing.
  ['machine.next', { machine: 'fetch', event: ['x'] }],
  ['web.markdown', { html: '<p>x</p>', extra: 1 }],
]

test(
  'a misspelled key or bad cursor gets an isError result',
  eff(
    Effect.scoped(
      Effect.gen(function* () {
        const client = yield* connected
        for (const [name, args] of bad) {
          const r = yield* Effect.promise(() => client.callTool({ name, arguments: args }))
          expect([name, args, r.isError]).toEqual([name, args, true])
        }
      }),
    ),
  ),
  30_000,
)
