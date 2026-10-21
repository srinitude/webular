// Outcome eval: an agent host that starts the plugin's MCP server gets an
// answer to initialize and tools/list in a few seconds, even when the optional
// MCP App views were never built (a fresh checkout has no dist/ui).
import { expect, test } from 'bun:test'
import { Effect } from 'effect'

const SERVER = new URL('../src/server.ts', import.meta.url).pathname
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

const startServer = Effect.promise(async () => {
  const started = performance.now()
  const child = Bun.spawn(['bun', SERVER], {
    stdin: new Blob([`${requests.map((r) => JSON.stringify(r)).join('\n')}\n`]),
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [out, err] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  return { out, err, seconds: (performance.now() - started) / 1000 }
})

test(
  'the plugin server answers initialize and tools/list within 10 seconds',
  () =>
    Effect.runPromise(
      startServer.pipe(
        Effect.tap(({ out, err, seconds }) =>
          Effect.sync(() => {
            expect(err).toBe('')
            expect(out).toContain('"id":1')
            expect(out).toContain('"id":2')
            expect(seconds).toBeLessThan(10)
          }),
        ),
      ),
    ),
  30_000,
)
