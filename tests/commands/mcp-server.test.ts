// MCP server contract (B26/B27/D3) — real SDK client/server over an in-memory
// transport: tool listing, a working call, {html}-only readability input, and
// isError (not a protocol crash) when a tool throws; and the same MCP App
// views the plugin's Mastra server lists and serves.
import { describe, expect, test } from 'bun:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Effect, Schema } from 'effect'
import { server as plugin } from '../../plugins/webular/src/server.ts'
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

  test(
    'lists and serves the same app resources as the plugin server',
    eff(
      Effect.gen(function* () {
        const client = yield* connected
        const { resources } = yield* io(() => client.listResources())
        const listed = yield* io(() => plugin.listResources())
        const byUri = (a: { uri: string }, b: { uri: string }) => a.uri.localeCompare(b.uri)
        expect(resources.map((r) => r.uri).sort()).toEqual([
          'ui://webular/map',
          'ui://webular/monitor',
          'ui://webular/session',
        ])
        expect(resources.toSorted(byUri)).toEqual(listed.resources.toSorted(byUri))
        for (const { uri } of resources) {
          const [mine, theirs] = yield* Effect.all([
            io(() => client.readResource({ uri })),
            io(() => plugin.readResource(uri)),
          ])
          expect<unknown>(mine.contents).toEqual(theirs.contents)
          expect(mine.contents[0]).toMatchObject({
            mimeType: 'text/html;profile=mcp-app',
            text: expect.stringContaining('<script type="module"'),
          })
        }
      }),
    ),
    30_000,
  )
})
