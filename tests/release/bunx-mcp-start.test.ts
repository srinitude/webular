// `bunx webular mcp` from an empty Bun cache starts the published MCP server:
// it answers initialize as webular and lists its tools. A clean cache must
// fetch the package and its platform binary from the npm registry, so the case
// runs only with WEBULAR_TEST_LIVE=1.
import { expect, test } from 'bun:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from '@modelcontextprotocol/sdk/client/stdio.js'
import { Config, Effect } from 'effect'
import { eff, io, tmpDir } from '../_support/run.ts'

const LIVE = Effect.runSync(
  Config.String('WEBULAR_TEST_LIVE').pipe(Config.withDefault(''), Effect.orDie),
)

test.skipIf(LIVE !== '1')(
  'bunx webular mcp starts from a clean cache and lists its tools',
  eff(
    Effect.gen(function* () {
      const cache = yield* tmpDir('bunx-cache-')
      const client = new Client({ name: 'bunx-start-test', version: '0.0.0' })
      const transport = new StdioClientTransport({
        command: 'bunx',
        args: ['webular@latest', 'mcp'],
        env: { ...getDefaultEnvironment(), BUN_INSTALL_CACHE_DIR: cache },
      })
      yield* Effect.acquireRelease(
        io(() => client.connect(transport)),
        () => Effect.promise(() => client.close()),
      )
      expect(client.getServerVersion()?.name).toBe('webular')
      const tools = yield* io(() => client.listTools())
      expect(tools.tools.length).toBeGreaterThan(0)
    }),
  ),
  180_000,
)
