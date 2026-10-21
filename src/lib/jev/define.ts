// defineDecision: the one definer every Jev or decision-model decision in webular
// uses. A decision without a docs-checked payload, a labeled eval file, the 0.95 bar,
// a fallback, a code check after the pick, or the docs hash it was validated
// against does not typecheck. tests/jev/define.test.ts proves the rest in CI.
import { Effect } from 'effect'
import { JEV_MODEL_DEFAULT, Jev, type JevAnswer, type JevRequest } from './client.ts'
import { JevPayloadTooLarge } from './errors.ts'
import { type CONFIDENCE_BAR, JEV_TOKEN_CAP, payloadTokens, requestBytes } from './payload/index.ts'

// Runs `jevPart` when Jev is available; any error uses `fallback`. The
// fallback is lazy, so a rule that scans the whole input runs only when needed.
export const decide = <A>(
  decision: string,
  fallback: () => A,
  jevPart: (jev: Jev['Service']) => Effect.Effect<A, unknown, Jev>,
) =>
  Effect.gen(function* () {
    const jev = yield* Jev
    if (!jev.available) return fallback()
    return yield* jevPart(jev).pipe(Effect.orElseSucceed(fallback))
  }).pipe(Effect.withSpan(`jev.${decision}`))

// One step of the decision's split, in the decision-models-first mod's
// decomposition.json shape. `payload.question` names the question id in the
// request whose type must equal `primitive`.
interface Subtask {
  readonly name: string
  readonly primitive: 'choice' | 'score' | 'noul'
  readonly pattern:
    | 'fan-out'
    | 'confidence-routing'
    | 'composite-scoring'
    | 'intent-routing'
    | 'none'
  readonly payload: { readonly question: string }
}

// A pinned Jev model: a versioned id or jev-preview, never `jev`, `jev-latest`, or a `~alias`.
type PinnedModel = `jev-${number}.${number}.${number}` | 'jev-preview'

export interface DecisionDef<I, A> {
  readonly name: string
  // Set only when a decision needs a model other than the client default.
  readonly model?: PinnedModel
  readonly payload: (input: I) => JevRequest
  // A representative input: CI builds its payload and checks it against the docs limits.
  readonly sample: () => I
  readonly subtasks: readonly [Subtask, ...Subtask[]]
  // `read` returns undefined when Jev is under the bar, and the fallback decides.
  readonly read: (answers: Record<string, JevAnswer>, bar: number, input: I) => A | undefined
  readonly bar: typeof CONFIDENCE_BAR
  readonly fallback: (input: I) => A
  // Deterministic check after the pick; false hands the call to the fallback.
  readonly codeCheck: (picked: A, input: I) => boolean
  // JSON with non-empty "baseline-wins" and "baseline-loses" case lists.
  readonly evals: `tests/jev/evals/${string}.json`
  // sha256 of the llms-full.txt this decision was validated against.
  readonly docs: string
  // Token budget for one payload; defaults to JEV_TOKEN_CAP. Over it, the fallback decides.
  readonly maxTokens?: number
}

// Run-time size guard: a payload over `cap` tokens (chars / 4 of the canonical
// body) fails with JevPayloadTooLarge and is never sent.
export const guardPayload = (
  decision: string,
  req: JevRequest,
  cap: number = JEV_TOKEN_CAP,
  model: string = JEV_MODEL_DEFAULT,
): Effect.Effect<JevRequest, JevPayloadTooLarge> => {
  const tokens = payloadTokens(requestBytes(model, req.state, req.questions))
  return tokens > cap
    ? Effect.fail(new JevPayloadTooLarge({ decision, tokens, cap })).pipe(
        Effect.tapError((e) => Effect.logWarning(e.message)),
      )
    : Effect.succeed(req)
}

// The one place a Jev service is asked. defineDecision asks through it, and the
// call recorder wraps the service through it, so every ask stays here.
export const askJev = <R>(
  svc: { readonly ask: (decision: string, req: JevRequest) => R },
  decision: string,
  req: JevRequest,
) => svc.ask(decision, req)

// Each subtask's payload gets the full {model, state, questions} it sends, built from
// the definition's own sample, so lintSubtasks checks the real request. A getter, so
// sample() and payload() run only when a check reads the subtasks, never at import.
const withPayloads = <I, A>(def: DecisionDef<I, A>): DecisionDef<I, A> => ({
  ...def,
  get subtasks() {
    const built = def.payload(def.sample())
    const model = def.model ?? JEV_MODEL_DEFAULT
    return def.subtasks.map((s) => ({
      ...s,
      payload: {
        ...s.payload,
        model,
        state: built.state,
        questions: { [s.payload.question]: built.questions[s.payload.question] },
      },
    })) as unknown as DecisionDef<I, A>['subtasks']
  },
})

export const defineDecision = <I, A>(def: DecisionDef<I, A>) =>
  Object.assign(
    (input: I) =>
      decide(
        def.name,
        () => def.fallback(input),
        (jev) =>
          guardPayload(def.name, def.payload(input), def.maxTokens, def.model).pipe(
            Effect.flatMap((req) => askJev(jev, def.name, req)),
            Effect.map((r) => {
              const picked = def.read(r.answers, def.bar, input)
              return picked !== undefined && def.codeCheck(picked, input)
                ? picked
                : def.fallback(input)
            }),
          ),
      ),
    { def: withPayloads(def) },
  )
