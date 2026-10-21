// Docs guard: every Jev or decision-model batch runs against a verified snapshot of
// the model's own docs. The snapshot is refreshed with a conditional GET, so an
// unchanged doc costs one 304 and no parse. Payloads that break a limit the docs
// state fail before the call. With no verified snapshot the call is refused and
// the caller's code rule decides. Parts: docs-snapshot (proof), docs-violations
// (limit checks), docs-fetch (refresh); this file is the wrapper and the public path.
import { Effect, Schema } from 'effect'
import { cachedRefresh, type DocsState } from './docs-cache.ts'
import { DocsRefused, type Fetcher, type GuardLog } from './docs-fetch.ts'
import { committedSnapshot, DECISION_MODELS, type DocsLimits } from './docs-snapshot.ts'
import { isObject, violations } from './docs-violations.ts'

export { httpFetcher } from './docs-fetch.ts'
export { committedSnapshot } from './docs-snapshot.ts'
export { violations } from './docs-violations.ts'

const decodeBody = (body: string) =>
  Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Unknown))(body).pipe(
    Effect.mapError(() => new DocsRefused({ reason: 'body is not JSON' })),
  )
const checked = (req: unknown, body: string, limits: DocsLimits) => {
  const broken = violations(req, limits, new TextEncoder().encode(body).length)
  return broken.length > 0
    ? Effect.fail(new DocsRefused({ reason: broken.join('; ') }))
    : Effect.succeed(req)
}
// The posted bytes, decoded and checked.
export const checkBody = (body: string, limits: DocsLimits = committedSnapshot.limits) =>
  decodeBody(body).pipe(Effect.flatMap((req) => checked(req, body, limits)))

const modelFor = (name: string) => DECISION_MODELS.find((m) => m.models.test(name))

// The wrapper every Jev or decision-model batch goes through: current docs, then
// the limits, then the call. A refusal leaves the caller's code rule in charge.
export const guarded = <A, E, R>(
  body: string,
  state: DocsState,
  get: Fetcher,
  log: (l: GuardLog) => Effect.Effect<void>,
  call: Effect.Effect<A, E, R>,
): Effect.Effect<A, E | DocsRefused, R> =>
  Effect.gen(function* () {
    const req = yield* decodeBody(body)
    const name = isObject(req) ? String(req['model']) : ''
    const model = modelFor(name)
    if (model === undefined)
      return yield* new DocsRefused({ reason: `${name}: not a registered decision model` })
    state.snapshot = yield* cachedRefresh(model, state, get, log)
    yield* checked(req, body, state.snapshot.limits)
    return yield* call
  })
