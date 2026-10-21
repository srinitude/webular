// Runs a decision on the shared Jev runtime (one LRU, one key lookup), so lib
// Effects keep no Jev requirement; a runtime failure keeps the fallback.
import { Effect } from 'effect'
import { type Jev, jevRuntime } from './client.ts'

export const onJevRuntime = <I, A>(
  d: ((input: I) => Effect.Effect<A, unknown, Jev>) & {
    readonly def: { readonly fallback: (i: I) => A }
  },
  input: I,
) =>
  Effect.tryPromise(() => jevRuntime.runPromise(d(input))).pipe(
    Effect.orElseSucceed(() => d.def.fallback(input)),
  )
