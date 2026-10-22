// A tool name that only exists on Object.prototype ("constructor") is still an
// unknown tool: `webular mcp` answers -32602, not a crash inside the SDK.
// Run by `mise run bugs:mcp-cli`.
import { expect, test } from 'bun:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Effect } from 'effect'
import { protocolErrors } from '../../src/tools/sdk-errors.ts'
import { eff, failMsg, io } from '../_support/run.ts'

const connected = Effect.acquireRelease(
  Effect.gen(function* () {
    const server = new McpServer({ name: 'webular-test', version: '0.0.0' })
    server.registerTool('known', { description: 'x' }, () => ({ content: [] }))
    protocolErrors(server)
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
    yield* io(() => server.connect(serverSide))
    const client = new Client({ name: 'test-client', version: '0.0.0' })
    yield* io(() => client.connect(clientSide))
    return client
  }),
  (client) => Effect.promise(() => client.close()),
)

test(
  'a tool named constructor is a -32602 unknown-tool error',
  eff(
    Effect.gen(function* () {
      const client = yield* connected
      const msg = yield* failMsg(io(() => client.callTool({ name: 'constructor', arguments: {} })))
      expect(msg).toContain('-32602')
    }),
  ),
)
