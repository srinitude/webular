// A ManagedRuntime built like the step runtime runs its layer finalizers on
// dispose, which is what runWorkflow relies on to stop the parse pool.
import { expect, test } from 'bun:test'
import { Effect, Layer, ManagedRuntime } from 'effect'

test('dispose runs the layer finalizer', () =>
  Effect.runPromise(
    Effect.gen(function* () {
      let released = false
      const layer = Layer.effectDiscard(
        Effect.addFinalizer(() =>
          Effect.sync(() => {
            released = true
          }),
        ),
      )
      const runtime = ManagedRuntime.make(layer)
      yield* Effect.promise(() => runtime.runPromise(Effect.void))
      expect(released).toBe(false)
      yield* runtime.disposeEffect
      expect(released).toBe(true)
    }),
  ))
