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
import { COMMAND_NAMES } from '../../src/cli/commands.ts'
import { NOT_ON_MCP, registerAll } from '../../src/tools/web.ts'
import { ROOT } from '../_support/root.ts'
import { eff, io } from '../_support/run.ts'

const connected = Effect.gen(function* () {
  const server = new McpServer({ name: 'webular-test', version: '0.0.0' })
  // Command tools start the checkout's own command files, so no install is needed.
  yield* registerAll(server, (command) => `${ROOT}src/commands/${command}.ts`)
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  yield* io(() => server.connect(serverTransport))
  const client = new Client({ name: 'test-client', version: '0.0.0' })
  yield* io(() => client.connect(clientTransport))
  return client
})

const ToolResult = Schema.fromJsonString(Schema.Struct({ title: Schema.String }))

describe('webular mcp — server behavior over a real transport', () => {
  test(
    'lists the four web tools and every command except the recorded NOT_ON_MCP ones',
    eff(
      Effect.gen(function* () {
        const client = yield* connected
        const { tools } = yield* io(() => client.listTools())
        const ids = tools.map((t) => t.name).sort()
        const commands = COMMAND_NAMES.filter((name) => !(name in NOT_ON_MCP))
        const web = ['web.fetch', 'web.links', 'web.markdown', 'web.readability']
        expect(ids).toEqual([...web, ...commands].sort())
      }),
    ),
    15_000,
  )

  test(
    'lists the same command tools as the plugin server: names, text, inputs, and hints',
    eff(
      Effect.gen(function* () {
        const client = yield* connected
        const { tools } = yield* io(() => client.listTools())
        const mine = tools.filter((t) => !t.name.startsWith('web.'))
        const theirs = (yield* io(async () => plugin.getToolListInfo())).tools
        type Listed = { name: string; description?: string | undefined; inputSchema: unknown }
        const shape = ({ name, description, inputSchema }: Listed) => {
          const schema = inputSchema as { properties?: object; required?: string[] }
          const inputs = Object.keys(schema.properties ?? {}).sort()
          return { name, description, inputs, required: [...(schema.required ?? [])].sort() }
        }
        const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)
        expect(mine.map(shape)).toEqual((theirs as Listed[]).toSorted(byName).map(shape))
        const meta = Object.fromEntries(theirs.map((t) => [t.name, t._meta]))
        for (const t of mine) expect(t._meta).toEqual(meta[t.name])
      }),
    ),
    15_000,
  )

  test(
    'a command tool runs the command and returns its JSON',
    eff(
      Effect.gen(function* () {
        const client = yield* connected
        const result = yield* io(() => client.callTool({ name: 'diagram', arguments: {} }))
        expect(result.isError ?? false).toBe(false)
        const text = (result.content as { type: string; text: string }[])[0]?.text ?? ''
        expect(JSON.parse(text).diagrams.length).toBeGreaterThan(0)
      }),
    ),
    30_000,
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
