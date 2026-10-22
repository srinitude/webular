// `webular mcp` refuses bad tool input with an isError result instead of
// dropping it: a misspelled key or a bad paging cursor. Run by `mise run bugs:mcp-cli`.
import { expect, test } from 'bun:test'
import * as BunServices from '@effect/platform-bun/BunServices'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Effect } from 'effect'
import { registerAll } from '../../src/tools/web.ts'
import { eff } from '../_support/run.ts'

const connected = Effect.acquireRelease(
  Effect.gen(function* () {
    const server = new McpServer({ name: 'webular-test', version: '0.0.0' })
    yield* registerAll(server).pipe(Effect.provide(BunServices.layer))
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
    yield* Effect.promise(() => server.connect(serverSide))
    const client = new Client({ name: 'test-client', version: '0.0.0' })
    yield* Effect.promise(() => client.connect(clientSide))
    return client
  }),
  (client) => Effect.promise(() => client.close()),
)

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
