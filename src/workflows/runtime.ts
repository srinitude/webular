// The one Promise edge for Mastra steps: a step's execute must return a
// Promise, so every step runs its Effect program through this one shared
// runtime, which carries the Bun platform services (FileSystem, Path,
// ChildProcessSpawner) that step programs yield, and the one Readability
// worker pool the source fan-out parses on.
import * as BunServices from '@effect/platform-bun/BunServices'
import { Layer, ManagedRuntime } from 'effect'
import { ParsePool } from '../lib/sources.ts'

export const stepRuntime = ManagedRuntime.make(Layer.mergeAll(BunServices.layer, ParsePool.layer))
