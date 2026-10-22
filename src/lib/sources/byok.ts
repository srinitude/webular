// The opt-in bring-your-own-key search tier: Brave Search, asked only when the
// run is switched on with --byok (WEBULAR_BYOK=1) and a key can be found. The
// key comes from BRAVE_API_KEY, else the macOS Keychain item "webular-brave".
// With no switch or no key nothing here runs, so keyless behavior is unchanged.
import { Config, Data, Effect, Option, Redacted, Schema } from 'effect'
import { ChildProcessSpawner } from 'effect/process'
import { runProc } from '../../core/proc.ts'
import { getJson, type Hit } from './polite.ts'

class ByokKeyMissing extends Data.TaggedError('ByokKeyMissing')<{ service: string }> {}

const KEYCHAIN_TIMEOUT_MS = 5_000

// The macOS `security` tool prints the stored secret; any failure (no item, no
// tool, no spawner in this run) means no key. The secret is wrapped Redacted
// at once and never logged.
const fromKeychain = (service: string) =>
  Effect.serviceOption(ChildProcessSpawner.ChildProcessSpawner).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.succeed(Option.none<Redacted.Redacted>()),
        onSome: (spawner) =>
          runProc(['security', 'find-generic-password', '-s', service, '-w'], {
            timeoutMs: KEYCHAIN_TIMEOUT_MS,
          }).pipe(
            Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
            Effect.map(({ code, stdout }) =>
              code === 0 && stdout.trim() !== ''
                ? Option.some(Redacted.make(stdout.trim()))
                : Option.none<Redacted.Redacted>(),
            ),
          ),
      }),
    ),
  )

// None unless WEBULAR_BYOK=1; then the env key, else the Keychain item.
export const byokKey = (envName: string, service: string) =>
  Effect.gen(function* () {
    const on = yield* Config.String('WEBULAR_BYOK').pipe(Config.withDefault(''))
    if (on !== '1') return Option.none<Redacted.Redacted>()
    const env = yield* Config.option(Config.Redacted(envName))
    return Option.isSome(env) ? env : yield* fromKeychain(service)
  }).pipe(Effect.orElseSucceed(() => Option.none<Redacted.Redacted>()))

const BRAVE_SERVICE = 'webular-brave'

export const braveKey = byokKey('BRAVE_API_KEY', BRAVE_SERVICE)

const Brave = Schema.fromJsonString(
  Schema.Struct({
    web: Schema.optional(
      Schema.Struct({
        results: Schema.Array(
          Schema.Struct({
            title: Schema.String,
            url: Schema.String,
            description: Schema.optional(Schema.String),
          }),
        ),
      }),
    ),
  }),
)

// Brave web search; at most 20 results a call. Fails with ByokKeyMissing when
// asked by name without --byok or a key.
export const brave = Effect.fn('brave')(function* (query: string, limit: number) {
  const key = yield* braveKey
  if (Option.isNone(key)) return yield* new ByokKeyMissing({ service: BRAVE_SERVICE })
  const { web } = yield* getJson(
    Brave,
    'https://api.search.brave.com/res/v1/web/search',
    { q: query, count: String(Math.min(limit, 20)) },
    { headers: { 'x-subscription-token': Redacted.value(key.value) } },
  )
  return (web?.results ?? []).map(
    (r): Hit => ({ title: r.title, url: r.url, description: r.description ?? '' }),
  )
})
