// MCP server contract (B26/B27/D3) — real SDK client/server over an in-memory
// transport: tool listing, a working call, {html}-only readability input, and
// isError (not a protocol crash) when a tool throws.
import { describe, expect, test } from 'bun:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerAll } from '../../src/tools/web.ts'

async function connected(): Promise<Client> {
  const server = new McpServer({ name: 'webular-test', version: '0.0.0' })
  registerAll(server)
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  const client = new Client({ name: 'test-client', version: '0.0.0' })
  await client.connect(clientTransport)
  return client
}

describe('webular mcp — server behavior over a real transport', () => {
  test('lists all four web tools', async () => {
    const client = await connected()
    const { tools } = await client.listTools()
    const ids = tools.map((t) => t.name).sort()
    expect(ids).toEqual(['web.fetch', 'web.links', 'web.markdown', 'web.readability'])
  }, 15_000)

  test('web.readability accepts {html} only (no dead url input)', async () => {
    const client = await connected()
    const result = await client.callTool({
      name: 'web.readability',
      arguments: {
        html: '<html><head><title>T</title></head><body><p>Body text.</p></body></html>',
      },
    })
    expect(result.isError ?? false).toBe(false)
    const text = (result.content as { type: string; text: string }[])[0]?.text ?? ''
    expect(JSON.parse(text).title.length).toBeGreaterThan(0)
  }, 15_000)

  test('a throwing tool returns isError content, not a protocol failure', async () => {
    const client = await connected()
    const result = await client.callTool({
      name: 'web.fetch',
      arguments: { url: 'http://127.0.0.1:1/unreachable' },
    })
    expect(result.isError).toBe(true)
  }, 15_000)
})
