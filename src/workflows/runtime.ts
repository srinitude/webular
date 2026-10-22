// The one Promise edge for Mastra steps: a step's execute must return a
// Promise, so every step runs its Effect program through this one shared
// runtime, which carries the Bun platform services (FileSystem, Path,
// ChildProcessSpawner) that step programs yield, and the one Readability
// worker pool the source fan-out parses on, and the per-origin robots.txt cache.
import { appendFileSync } from 'node:fs'
import * as BunServices from '@effect/platform-bun/BunServices'
import { Config, Effect, Layer, ManagedRuntime, Option } from 'effect'
import * as FetchHttpClient from 'effect/http/FetchHttpClient'
import { RobotsGate } from '../lib/robots-gate.ts'
import { ParsePool } from '../lib/sources.ts'

// With WEBULAR_REQUEST_LOG set, every request sent through the Fetch reference
// (robots.txt reads included) appends one JSON line { method, url } to that
// file; the file is created at build, so an empty file means no request.
// The bench runner reads it into Row.requests.
export const requestLog = Layer.unwrap(
  Effect.gen(function* () {
    const file = yield* Config.option(Config.String('WEBULAR_REQUEST_LOG'))
    if (Option.isNone(file)) return Layer.empty
    const base = yield* FetchHttpClient.Fetch
    yield* Effect.sync(() => appendFileSync(file.value, ''))
    const logged = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input)
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
      appendFileSync(file.value, `${JSON.stringify({ method, url })}\n`)
      return base(input, init)
    }) as typeof globalThis.fetch
    return Layer.succeed(FetchHttpClient.Fetch, logged)
  }),
)

export const stepRuntime = ManagedRuntime.make(
  Layer.mergeAll(BunServices.layer, ParsePool.layer, RobotsGate.layer).pipe(
    Layer.provideMerge(requestLog),
  ),
)

// Stops the parse pool's idle workers once a command ends. It never disposes
// the runtime: a disposed ManagedRuntime dies on every later run, and one
// process runs many workflows (the MCP server, a test run).
export const drainParsePool = Effect.tryPromise(() =>
  stepRuntime.runPromise(ParsePool.use((pool) => pool.drain)),
)
