// The one Promise edge for Mastra steps: a step's execute must return a
// Promise, so every step runs its Effect program through this one shared
// runtime, which carries the Bun platform services (FileSystem, Path,
// ChildProcessSpawner) that step programs yield.
import * as BunServices from '@effect/platform-bun/BunServices'
import { ManagedRuntime } from 'effect'

export const stepRuntime = ManagedRuntime.make(BunServices.layer)
