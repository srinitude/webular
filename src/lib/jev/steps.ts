// The door from a Mastra workflow to a Jev decision. Every Jev decision goes
// through decisionStep (or machineDecision in machine.ts for an XState-driven
// decision). The lint test in tests/jev/framework.test.ts fails on any workflow
// model call outside them.
import { createStep } from '@mastra/core/workflows'
import { Effect } from 'effect'
import type { z } from 'zod'
import { type Jev, jevRuntime } from './client.ts'

type Decide<D, A> = (input: D) => Effect.Effect<A, never, Jev>

// A Mastra step around one decision (built with `defineDecision`: payload
// builder, primitive, the 0.95 bar, code check, fallback). `prepare` does the step's own work
// once (sync or async); `pick` maps its result to decision input, and undefined skips Jev and
// passes undefined to `output`.
export const decisionStep = <IS extends z.ZodTypeAny, OS extends z.ZodTypeAny, P, D, A>(cfg: {
  readonly id: string
  readonly inputSchema: IS
  readonly outputSchema: OS
  readonly decide: Decide<D, A>
  readonly prepare: (data: z.infer<IS>) => P | Promise<P>
  readonly pick: (prepared: P) => D | undefined
  readonly output: (prepared: P, decided: A | undefined) => z.infer<OS>
}) =>
  createStep({
    id: cfg.id,
    inputSchema: cfg.inputSchema,
    outputSchema: cfg.outputSchema,
    execute: async ({ inputData }) => {
      const p = await cfg.prepare(inputData as z.infer<IS>)
      const d = cfg.pick(p)
      // Mastra's output type is the schema's public type; zod's infer is the same value.
      return jevRuntime.runPromise(
        d === undefined
          ? Effect.succeed(cfg.output(p, undefined))
          : cfg.decide(d).pipe(Effect.map((a) => cfg.output(p, a))),
      ) as Promise<never>
    },
  })
