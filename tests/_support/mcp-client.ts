// An in-memory `webular mcp` server and a client connected to it, closed with
// the scope. entryOf and limit pass through to registerAll.
import * as BunServices from '@effect/platform-bun/BunServices'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { type Duration, Effect } from 'effect'
import type { EntryOf } from '../../plugins/webular/src/commands.ts'
import { registerAll } from '../../src/tools/web.ts'

export const connectedWith = (entryOf?: EntryOf, limit?: Duration.Input) =>
  Effect.acquireRelease(
    Effect.gen(function* () {
      const server = new McpServer({ name: 'webular-test', version: '0.0.0' })
      yield* registerAll(server, entryOf, limit).pipe(Effect.provide(BunServices.layer))
      const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
      yield* Effect.promise(() => server.connect(serverSide))
      const client = new Client({ name: 'test-client', version: '0.0.0' })
      yield* Effect.promise(() => client.connect(clientSide))
      return client
    }),
    (client) => Effect.promise(() => client.close()),
  )

export const connected = connectedWith()
