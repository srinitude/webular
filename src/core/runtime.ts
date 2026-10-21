// The one Effect runtime where Effect code meets the not-yet-Effect callers.
// ponytail: built on Layer.empty, so it owns no resources and needs no dispose;
// once the CLI runs Effect end to end, run once at the process edge instead.
import { Layer, ManagedRuntime } from 'effect'

export const runtime = ManagedRuntime.make(Layer.empty)
