// Runs a decision on the shared Jev runtime's services (one LRU, one key
// lookup), so lib Effects keep no Jev requirement; a failure keeps the fallback.
import { Effect } from 'effect'
import { type Jev, jevRuntime } from './client.ts'

export const onJevRuntime = <I, A>(
  d: ((input: I) => Effect.Effect<A, unknown, Jev>) & {
    readonly def: { readonly fallback: (i: I) => A }
  },
  input: I,
) =>
  Effect.flatMap(jevRuntime.contextEffect, (ctx) => Effect.provideContext(d(input), ctx)).pipe(
    Effect.orElseSucceed(() => d.def.fallback(input)),
  )
