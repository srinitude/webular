// MCP server contract (B26/B27/D3) — real SDK client/server over an in-memory
// transport: tool listing, a working call, {html}-only readability input, and
// isError (not a protocol crash) when a tool throws.
import { describe, expect, test } from 'bun:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Effect, Schema } from 'effect'
import { registerAll } from '../../src/tools/web.ts'
import { eff, io } from '../_support/run.ts'

const connected = Effect.gen(function* () {
  const server = new McpServer({ name: 'webular-test', version: '0.0.0' })
  yield* registerAll(server)
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  yield* io(() => server.connect(serverTransport))
  const client = new Client({ name: 'test-client', version: '0.0.0' })
  yield* io(() => client.connect(clientTransport))
  return client
})

const ToolResult = Schema.fromJsonString(Schema.Struct({ title: Schema.String }))

describe('webular mcp — server behavior over a real transport', () => {
  test(
    'lists all four web tools',
    eff(
      Effect.gen(function* () {
        const client = yield* connected
        const { tools } = yield* io(() => client.listTools())
        const ids = tools.map((t) => t.name).sort()
        expect(ids).toEqual(['web.fetch', 'web.links', 'web.markdown', 'web.readability'])
      }),
    ),
    15_000,
  )

  test(
    'web.readability accepts {html} only (no dead url input)',
    eff(
      Effect.gen(function* () {
        const client = yield* connected
        const result = yield* io(() =>
          client.callTool({
            name: 'web.readability',
            arguments: {
              html: '<html><head><title>T</title></head><body><p>Body text.</p></body></html>',
            },
          }),
        )
        expect(result.isError ?? false).toBe(false)
        const text = (result.content as { type: string; text: string }[])[0]?.text ?? ''
        const parsed = yield* Schema.decodeUnknownEffect(ToolResult)(text)
        expect(parsed.title.length).toBeGreaterThan(0)
      }),
    ),
    15_000,
  )

  test(
    'a throwing tool returns isError content, not a protocol failure',
    eff(
      Effect.gen(function* () {
        const client = yield* connected
        const result = yield* io(() =>
          client.callTool({
            name: 'web.fetch',
            arguments: { url: 'http://127.0.0.1:1/unreachable' },
          }),
        )
        expect(result.isError).toBe(true)
      }),
    ),
    15_000,
  )
})
