// The one Promise edge for Mastra steps: a step's execute must return a
// Promise, so every step runs its Effect program through this one shared
// runtime, which carries the Bun platform services (FileSystem, Path,
// ChildProcessSpawner) that step programs yield, and the one Readability
// worker pool the source fan-out parses on, and the per-origin robots.txt cache.
import * as BunServices from '@effect/platform-bun/BunServices'
import { Effect, Layer, ManagedRuntime } from 'effect'
import { RobotsGate } from '../lib/robots-gate.ts'
import { ParsePool } from '../lib/sources.ts'

export const stepRuntime = ManagedRuntime.make(
  Layer.mergeAll(BunServices.layer, ParsePool.layer, RobotsGate.layer),
)

// Stops the parse pool's idle workers once a command ends. It never disposes
// the runtime: a disposed ManagedRuntime dies on every later run, and one
// process runs many workflows (the MCP server, a test run).
export const drainParsePool = Effect.tryPromise(() =>
  stepRuntime.runPromise(ParsePool.use((pool) => pool.drain)),
)
