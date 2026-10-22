// The door for code outside src/lib/jev that builds its own Jev questions and
// reads the raw answers (the Cua grounder, the answer-mode subject filter, the
// Stately planner). It asks the shared Jev client through askJev, so every call
// runs the docs guard, the size guard, the cache, and the call recorder.
import { Effect } from 'effect'
import { Jev, type JevAnswer, type JevRequest, withSharedJev } from './client.ts'
import { askJev, guardPayload } from './define.ts'

// Fails when Jev is off or the call fails; callers fall back to their code rule.
export const askAnswers = (
  decision: string,
  req: { readonly state: unknown; readonly questions: unknown },
): Effect.Effect<Record<string, JevAnswer>, unknown> =>
  Effect.gen(function* () {
    const jev = yield* Jev
    if (!jev.available) return yield* Effect.fail('Jev is off')
    const guarded = yield* guardPayload(decision, req as JevRequest)
    return (yield* askJev(jev, decision, guarded)).answers
  }).pipe(withSharedJev)
