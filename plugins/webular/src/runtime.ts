// The one Effect runtime for the plugin. Swap this layer for the CLI's
// src/core/effect.ts runtime when the two share one.
import { BunServices } from '@effect/platform-bun'
import { ManagedRuntime } from 'effect'

export const runtime = ManagedRuntime.make(BunServices.layer)
