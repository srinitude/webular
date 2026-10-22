// Outcome evals for HTTP mode: the same server answers over Streamable HTTP
// on the port it is given, and at its stable portless name when portless is
// installed. Real processes, real HTTP, no mocks.
import { expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'
import { BunServices } from '@effect/platform-bun'
import { MCPClient } from '@mastra/mcp'
import { Effect, Random, Schedule } from 'effect'
import * as FetchHttpClient from 'effect/http/FetchHttpClient'
import * as HttpClient from 'effect/http/HttpClient'
import { ChildProcess, ChildProcessSpawner } from 'effect/process'

const serverPath = fileURLToPath(new URL('../src/server.ts', import.meta.url))

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

const statusWith = (url: string, headers: Record<string, string>) =>
  HttpClient.HttpClient.pipe(
    Effect.flatMap((http) => http.post(url, { headers })),
    Effect.map((res) => res.status),
    Effect.provide(FetchHttpClient.layer),
  )

// DNS rebinding guard: the MCP spec says a bad Origin MUST get 403.
test(
  'HTTP mode answers 403 to a foreign Origin or Host',
  () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const port = yield* Random.nextIntBetween(40_000, 49_000)
        const url = `http://127.0.0.1:${port}/mcp`
        const statuses = yield* whileRunning(
          ChildProcess.make('bun', [serverPath, '--http'], {
            env: { PORT: String(port) },
            extendEnv: true,
          }),
          Effect.all([
            statusWith(url, { origin: 'https://evil.example' }),
            statusWith(url, { host: 'evil.example' }),
            statusWith(url, { origin: 'null' }),
          ]),
        )
        expect(statuses).toEqual([403, 403, 403])
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
          // `run --name` adds the worktree/branch prefix, matching what `portless get` prints.
          ChildProcess.make('portless', [
            'run',
            '--name',
            'webular-mcp-test',
            'bun',
            serverPath,
            '--http',
          ]),
          ChildProcessSpawner.ChildProcessSpawner.pipe(
            Effect.flatMap((spawner) =>
              spawner.string(ChildProcess.make('portless', ['get', 'webular-mcp-test'])),
            ),
            Effect.map((url) => url.trim()),
            Effect.tap((url) =>
              Effect.sync(() =>
                expect(url).toMatch(/^https?:\/\/([\w.-]+\.)?webular-mcp-test\.localhost/),
              ),
            ),
            Effect.flatMap((url) => toolNamesAt(`${url}/mcp`)),
          ),
        )
        expect(names).toContain('webular_scrape')
      }),
    ),
  30_000,
)
