// Outcome evals for HTTP mode: the same server answers over Streamable HTTP
// on the port it is given, and at its stable portless name when portless is
// installed. Real processes, real HTTP, no mocks.
import { expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { MCPClient } from '@mastra/mcp'
import { Effect, Random, Schedule } from 'effect'
import { ChildProcess, ChildProcessSpawner } from 'effect/process'

const serverPath = new URL('../src/server.ts', import.meta.url).pathname

const toolNamesAt = (url: string) =>
  Effect.acquireUseRelease(
    Effect.sync(() => new MCPClient({ servers: { webular: { url: new URL(url) } } })),
    (client) =>
      Effect.tryPromise(() => client.listTools()).pipe(
        Effect.map(Object.keys),
        Effect.filterOrFail(
          (names) => names.length > 0,
          () => `no tools at ${url} yet`,
        ),
      ),
    (client) => Effect.promise(() => client.disconnect()),
  )

// Starts `cmd` for the length of the scope, then retries `probe` until it answers.
const whileRunning = <A>(
  cmd: ChildProcess.Command,
  probe: Effect.Effect<A, unknown, ChildProcessSpawner.ChildProcessSpawner>,
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      yield* spawner.spawn(cmd)
      return yield* probe.pipe(Effect.retry({ schedule: Schedule.spaced('250 millis'), times: 60 }))
    }),
  ).pipe(Effect.provide(BunServices.layer))

test(
  'HTTP mode answers MCP requests on the port it is given',
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const port = yield* Random.nextIntBetween(40_000, 49_000)
        const names = yield* whileRunning(
          ChildProcess.make('bun', [serverPath, '--http'], {
            env: { PORT: String(port) },
            extendEnv: true,
          }),
          toolNamesAt(`http://127.0.0.1:${port}/mcp`),
        )
        expect(names).toContain('webular_scrape')
      }),
    ),
  30_000,
)

test.skipIf(!Bun.which('portless'))(
  'HTTP mode answers at its stable portless URL',
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const names = yield* whileRunning(
          ChildProcess.make('portless', ['webular-mcp-test', 'bun', serverPath, '--http']),
          ChildProcessSpawner.ChildProcessSpawner.pipe(
            Effect.flatMap((spawner) =>
              spawner.string(ChildProcess.make('portless', ['get', 'webular-mcp-test'])),
            ),
            Effect.map((url) => url.trim()),
            Effect.tap((url) =>
              Effect.sync(() => expect(url).toMatch(/^https?:\/\/webular-mcp-test\.localhost/)),
            ),
            Effect.flatMap((url) => toolNamesAt(`${url}/mcp`)),
          ),
        )
        expect(names).toContain('webular_scrape')
      }),
    ),
  30_000,
)
