// `webular mcp` answers with JSON-RPC protocol errors, as the MCP spec says:
// -32602 for an unknown tool name and -32700 for a stdin line that is not JSON.
// Run by `mise run bugs:mcp-cli`.
import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { protocolErrors } from '../../src/tools/sdk-errors.ts'

test('an unknown tool name is a -32602 error, not an isError result', async () => {
  const server = new McpServer({ name: 'webular-test', version: '0.0.0' })
  server.registerTool('known', { description: 'x' }, async () => ({ content: [] }))
  protocolErrors(server)
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await server.connect(serverSide)
  const client = new Client({ name: 'test-client', version: '0.0.0' })
  await client.connect(clientSide)
  const err = await client.callTool({ name: 'nope', arguments: {} }).catch((e) => e)
  expect(err.code).toBe(-32602)
  expect((await client.callTool({ name: 'known', arguments: {} })).isError).toBeUndefined()
  await client.close()
})

test('a malformed stdin line gets a -32700 Parse error response', async () => {
  const proc = Bun.spawn(['bun', join(import.meta.dir, '../../src/commands/mcp.ts')], {
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'ignore',
  })
  proc.stdin.write('{not json\n')
  proc.stdin.flush()
  const line = await proc.stdout.getReader().read()
  proc.kill()
  const reply = JSON.parse(new TextDecoder().decode(line.value).split('\n')[0] ?? '')
  expect(reply.error.code).toBe(-32700)
  expect(reply.id).toBeNull()
}, 30_000)
