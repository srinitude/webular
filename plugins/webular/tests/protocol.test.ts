// A client that opens with an older MCP protocol version gets that version
// back (the lifecycle spec's negotiation rule), and a real tool call then
// works over the same stdio connection. Real server, real SDK client, no mocks.
import { expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/client'
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { Effect } from 'effect'
import { runtime } from '../src/runtime.ts'

const serverPath = fileURLToPath(new URL('../src/server.ts', import.meta.url))
const commandsDir = fileURLToPath(new URL('../../../src/commands', import.meta.url))

const connect = (version: string) =>
  Effect.sync(
    () =>
      new Client(
        { name: 'webular-protocol-test', version: '0' },
        { supportedProtocolVersions: [version], versionNegotiation: { mode: 'legacy' } },
      ),
  ).pipe(
    Effect.tap((client) =>
      Effect.tryPromise(() =>
        client.connect(
          new StdioClientTransport({
            command: 'bun',
            args: [serverPath],
            env: { ...getDefaultEnvironment(), WEBULAR_COMMANDS_DIR: commandsDir },
          }),
        ),
      ),
    ),
  )

// Opens a 2025-era connection at `version`, closed after `use`.
const withLegacyClient = <A>(version: string, use: (client: Client) => Effect.Effect<A, unknown>) =>
  Effect.acquireUseRelease(connect(version), use, (client) => Effect.promise(() => client.close()))

for (const version of ['2025-11-25', '2025-06-18', '2025-03-26']) {
  test(`a ${version} client gets ${version} back and a tool call works`, () =>
    runtime.runPromise(
      withLegacyClient(version, (client) =>
        Effect.gen(function* () {
          expect(client.getNegotiatedProtocolVersion()).toBe(version)
          const result = yield* Effect.tryPromise(() =>
            client.callTool({
              name: 'summarize',
              arguments: { text: 'Webular turns pages into text. It is fast.' },
            }),
          )
          expect(result.isError).toBeFalsy()
          expect(JSON.stringify(result.content)).toContain('Webular turns pages into text.')
        }),
      ).pipe(Effect.timeout('25 seconds')),
    ))
}
