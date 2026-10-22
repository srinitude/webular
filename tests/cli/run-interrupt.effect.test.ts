// Ctrl-C interrupts the CLI's main fiber; runWorkflow must cancel the Mastra
// run so the step's abortSignal fires and its Effect, with any child process
// it holds, is interrupted instead of left running.
import { expect, test } from 'bun:test'
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { Deferred, Effect, Fiber } from 'effect'
import { z } from 'zod'
import { runWorkflow } from '../../src/cli/run.ts'
import { stepRuntime } from '../../src/workflows/runtime.ts'
import { eff } from '../_support/run.ts'

const io = z.object({})

test(
  'interrupting runWorkflow interrupts the running step',
  eff(
    Effect.gen(function* () {
      const started = yield* Deferred.make<void>()
      const stopped = yield* Deferred.make<void>()
      const step = createStep({
        id: 'hang',
        inputSchema: io,
        outputSchema: io,
        execute: ({ abortSignal }) =>
          stepRuntime.runPromise(
            Deferred.succeed(started, undefined).pipe(
              Effect.andThen(Effect.never),
              Effect.onInterrupt(() => Deferred.succeed(stopped, undefined)),
            ),
            { signal: abortSignal },
          ),
      })
      // Mastra's builder .then chains steps; it is not a Promise.
      const workflow = createWorkflow({ id: 'hang', inputSchema: io, outputSchema: io })
        .then(step)
        .commit()
      const load = () => Effect.runPromise(Effect.succeed({ workflow }))
      const fiber = yield* Effect.forkChild(
        runWorkflow('hang', load, (m) => m.workflow, {}, { json: true }),
      )
      yield* Deferred.await(started)
      yield* Fiber.interrupt(fiber)
      const done = yield* Deferred.await(stopped).pipe(Effect.timeoutOption('2 seconds'))
      expect(done._tag).toBe('Some')
    }),
  ),
)
