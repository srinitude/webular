// Outcome eval: an agent host that starts the plugin's MCP server gets an
// answer to initialize and tools/list in a few seconds.
import { expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'
import { Duration, Effect } from 'effect'
import { runProc } from '../../../src/core/proc.ts'
import { eff } from '../../../tests/_support/run.ts'
import descriptions from '../src/descriptions.json' with { type: 'json' }

const SERVER = fileURLToPath(new URL('../dist/server.js', import.meta.url))
const requests = [
  {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'startup-test', version: '0' },
    },
  },
  { jsonrpc: '2.0', method: 'notifications/initialized' },
  { jsonrpc: '2.0', id: 2, method: 'tools/list' },
]

// Effect.timed reads the monotonic clock, so the budget is real elapsed time.
const startServer = runProc(['bun', SERVER], {
  timeoutMs: 20_000,
  stdin: `${requests.map((r) => JSON.stringify(r)).join('\n')}\n`,
}).pipe(Effect.timed)

test(
  'the plugin server answers initialize and tools/list within 10 seconds',
  eff(
    Effect.gen(function* () {
      const [elapsed, { stdout, stderr }] = yield* startServer
      expect(stderr).toBe('')
      expect(stdout).toContain('"id":1')
      expect(stdout).toContain('"id":2')
      // The plugin server sends the call directive at initialize.
      expect(JSON.parse(stdout.split('\n')[0] ?? '').result.instructions).toBe(
        descriptions.instructions,
      )
      expect(Duration.toSeconds(elapsed)).toBeLessThan(10)
    }),
  ),
  30_000,
)
